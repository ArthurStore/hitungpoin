import { getGeminiApiKey, bumpGeminiUsage, loadSettings } from '../config/settingsStore.js';

const SYSTEM_PROMPT = `Analisis screenshot scoreboard Free Fire ini. Ekstrak data semua tim/player ke dalam format JSON ARRAY murni tanpa teks/markdown tambahan. Format yang wajib dikembalikan:
[
  { "rank": 1, "team_name": "EXC", "kills": 2 },
  { "rank": 2, "team_name": "Dipsy95", "kills": 6 }
]

Aturan:
- rank: integer 1-12 (placement / booyah = 1)
- team_name: tag tim atau nickname player sesuai layar
- kills: integer jumlah kill (0 jika tidak terbaca)
- Maksimal 12 baris, urut naik berdasarkan rank
- Jangan tambahkan markdown, code fence, atau teks penjelasan di luar JSON array`;

const DEFAULT_MODEL = 'gemini-2.0-flash';

function extractJson(text) {
  if (!text) return null;

  const cleanResponse = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleanResponse);
  } catch {
    const arrayMatch = cleanResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch { /* fall through */ }
    }

    const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeResults(parsed) {
  const list = Array.isArray(parsed?.results) ? parsed.results
    : Array.isArray(parsed) ? parsed
      : [];

  return list
    .map((r) => ({
      rank: parseInt(r.rank ?? r.placement ?? r.place, 10),
      placement: parseInt(r.rank ?? r.placement ?? r.place, 10),
      teamName: String(r.team_name || r.teamName || r.nickname || r.name || '').trim(),
      nickname: String(r.team_name || r.teamName || r.nickname || r.name || '').trim(),
      kills: parseInt(r.kills ?? r.kill ?? 0, 10) || 0,
    }))
    .filter((r) => r.rank >= 1 && r.rank <= 12 && r.teamName)
    .sort((a, b) => a.rank - b.rank);
}

function getModelName() {
  return loadSettings().geminiModel || process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * Call Gemini Developer API via REST + x-goog-api-key.
 * Avoids SDK Vertex/OAuth confusion that causes ACCESS_TOKEN_TYPE_UNSUPPORTED on AQ.* keys.
 */
async function callGeminiGenerateContent({ apiKey, model, parts }) {
  // Ensure we never accidentally hit Vertex via env
  const prevVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI;
  delete process.env.GOOGLE_GENAI_USE_VERTEXAI;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
      const reason = data?.error?.details?.[0]?.reason || data?.error?.status || '';
      const err = new Error(reason ? `${msg} [${reason}]` : msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    const text = (data?.candidates || [])
      .flatMap((c) => c?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    return { text, raw: data };
  } finally {
    if (prevVertex !== undefined) process.env.GOOGLE_GENAI_USE_VERTEXAI = prevVertex;
  }
}

function friendlyAuthError(err) {
  const msg = err?.message || String(err);
  if (
    err?.status === 401
    || /UNAUTHENTICATED|ACCESS_TOKEN_TYPE_UNSUPPORTED|invalid authentication/i.test(msg)
  ) {
    return (
      'Gemini API key ditolak (401 UNAUTHENTICATED). ' +
      'Pastikan key dari https://aistudio.google.com/apikey (Gemini API), ' +
      'bukan OAuth/token lain. Jika key berawalan AQ. masih 401, buat project/key baru di AI Studio ' +
      'atau enable Generative Language API di Google Cloud Console.'
    );
  }
  return msg;
}

export async function runGeminiVisionOcr(imageBuffer, mimeType = 'image/png') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY not configured', engine: 'gemini', text: '', results: [] };
  }

  const started = Date.now();
  try {
    const model = getModelName();
    const base64 = imageBuffer.toString('base64');

    const { text } = await callGeminiGenerateContent({
      apiKey,
      model,
      parts: [
        { text: SYSTEM_PROMPT },
        { inlineData: { mimeType: mimeType || 'image/png', data: base64 } },
      ],
    });

    const parsed = extractJson(text);
    const results = normalizeResults(parsed);
    const latency = Date.now() - started;

    if (!results.length) {
      bumpGeminiUsage(latency, false, 'No results parsed from Gemini response');
      return {
        success: false,
        error: 'Gemini returned no parseable results',
        engine: 'gemini',
        text,
        results: [],
        latencyMs: latency,
      };
    }

    bumpGeminiUsage(latency, true);
    const textLines = results.map((r) => `${r.rank} ${r.teamName} ${r.kills} Kill`).join('\n');

    return {
      success: true,
      engine: 'gemini',
      text: textLines,
      results,
      latencyMs: latency,
      raw: text,
      model,
    };
  } catch (err) {
    const latency = Date.now() - started;
    const error = friendlyAuthError(err);
    bumpGeminiUsage(latency, false, error);
    return {
      success: false,
      error,
      engine: 'gemini',
      text: '',
      results: [],
      latencyMs: latency,
    };
  }
}

export async function testGeminiConnection(apiKeyOverride) {
  const apiKey = (apiKeyOverride || getGeminiApiKey() || '').trim();
  if (!apiKey) return { ok: false, error: 'No API key set' };

  const started = Date.now();
  try {
    const model = getModelName();
    const { text } = await callGeminiGenerateContent({
      apiKey,
      model,
      parts: [{ text: 'Reply with exactly: OK' }],
    });
    const latency = Date.now() - started;
    return { ok: true, latencyMs: latency, sample: (text || '').slice(0, 40), model };
  } catch (err) {
    return {
      ok: false,
      error: friendlyAuthError(err),
      latencyMs: Date.now() - started,
    };
  }
}
