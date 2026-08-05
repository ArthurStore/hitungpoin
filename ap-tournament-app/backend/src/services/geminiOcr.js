import { getGeminiApiKey, bumpGeminiUsage, loadSettings } from '../config/settingsStore.js';

const SYSTEM_PROMPT = `Analisis screenshot scoreboard Free Fire ini. Ekstrak data semua tim/player ke dalam format JSON ARRAY murni tanpa teks/markdown tambahan. Format yang wajib dikembalikan:
[
  { "rank": 1, "team_name": "EXC", "kills": 2 },
  { "rank": 2, "team_name": "Dipsy95", "kills": 6 }
]

Aturan:
- rank: integer 1-12 (placement / booyah = 1)
- team_name: tag tim atau nickname player sesuai layar (perwakilan yang terbaca)
- kills: integer jumlah kill (0 jika tidak terbaca)
- Maksimal 12 baris, urut naik berdasarkan rank
- Jangan tambahkan markdown, code fence, atau teks penjelasan di luar JSON array
- Baca SEMUA baris yang terlihat di screenshot — jangan kembalikan [] jika ada data skor/tim
- Hanya kembalikan [] jika gambar benar-benar kosong / bukan scoreboard`;

/** Alias non-versioned — hindari model static (2.0 / 2.5 / 1.5 / 1.0) yang sering 404 / deprecated */
const DEFAULT_MODEL = 'gemini-flash-latest';

const RESULT_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      rank: { type: 'INTEGER' },
      team_name: { type: 'STRING' },
      kills: { type: 'INTEGER' },
    },
    required: ['rank', 'team_name', 'kills'],
  },
};

function extractJson(text) {
  if (!text) return null;

  let cleanResponse = String(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/^\uFEFF/, '')
    .trim();

  const firstBracket = Math.min(
    ...[cleanResponse.indexOf('['), cleanResponse.indexOf('{')]
      .filter((i) => i >= 0)
  );
  if (Number.isFinite(firstBracket) && firstBracket > 0) {
    cleanResponse = cleanResponse.slice(firstBracket);
  }

  try {
    return JSON.parse(cleanResponse);
  } catch {
    const arrayMatch = cleanResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const fixed = arrayMatch[0].replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(fixed);
      } catch { /* fall through */ }
    }

    const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const fixed = objectMatch[0].replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/** Last-resort: parse plain lines like "1 EXC 2" / "1. EXC - 2 kills" */
function parseLooseLines(text) {
  if (!text) return [];
  const results = [];
  const seen = new Set();
  String(text).split(/\r?\n/).forEach((line) => {
    const m = line.match(
      /(?:^|\b)(\d{1,2})[.)\s:-]+([A-Za-z0-9_\-!?.][A-Za-z0-9_\-!?.\s]{0,28}?)\s+(\d{1,3})\b/
    );
    if (!m) return;
    const rank = parseInt(m[1], 10);
    if (rank < 1 || rank > 12 || seen.has(rank)) return;
    seen.add(rank);
    results.push({
      rank,
      placement: rank,
      teamName: m[2].trim(),
      nickname: m[2].trim(),
      kills: parseInt(m[3], 10) || 0,
    });
  });
  return results.sort((a, b) => a.rank - b.rank);
}

function normalizeResults(parsed) {
  const list = Array.isArray(parsed?.results) ? parsed.results
    : Array.isArray(parsed?.data) ? parsed.data
      : Array.isArray(parsed?.teams) ? parsed.teams
        : Array.isArray(parsed) ? parsed
          : (parsed && typeof parsed === 'object' && (parsed.rank != null || parsed.team_name || parsed.teamName)
            ? [parsed]
            : []);

  return list
    .map((r) => ({
      rank: parseInt(r.rank ?? r.placement ?? r.place, 10),
      placement: parseInt(r.rank ?? r.placement ?? r.place, 10),
      teamName: String(r.team_name || r.teamName || r.nickname || r.name || r.player || '').trim(),
      nickname: String(r.nickname || r.team_name || r.teamName || r.name || r.player || '').trim(),
      kills: parseInt(r.kills ?? r.kill ?? r.elim ?? r.eliminations ?? 0, 10) || 0,
    }))
    .filter((r) => r.rank >= 1 && r.rank <= 12 && r.teamName)
    .sort((a, b) => a.rank - b.rank);
}

function getModelName() {
  const fromSettings = loadSettings().geminiModel;
  const fromEnv = process.env.GEMINI_MODEL;
  const raw = (fromSettings || fromEnv || DEFAULT_MODEL).trim();

  // Paksa alias latest — model static sering 404 / deprecated
  if (/^gemini-(1\.0|1\.5|2\.0|2\.5)(-|$)/i.test(raw) || raw === 'gemini-pro' || raw === 'gemini-flash') {
    return DEFAULT_MODEL;
  }
  return raw || DEFAULT_MODEL;
}

function extractTextFromResponse(data) {
  const candidates = data?.candidates || [];
  if (!candidates.length) {
    const block = data?.promptFeedback?.blockReason || data?.promptFeedback?.block_reason;
    return {
      text: '',
      finishReason: null,
      blockReason: block || 'NO_CANDIDATES',
    };
  }

  const candidate = candidates[0];
  const finishReason = candidate.finishReason || candidate.finish_reason || null;
  const parts = candidate?.content?.parts || [];

  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim()
    || parts.map((p) => p.text || '').join('').trim();

  return { text, finishReason, blockReason: null };
}

/**
 * REST Gemini API — MUST use snake_case field names for multimodal parts.
 * camelCase (inlineData) is silently ignored → model only sees text → returns [].
 *
 * JANGAN kirim thinkingConfig ke gemini-flash-latest (Gemini 3):
 * thinkingBudget:0 → 400 "Request contains an invalid argument."
 * Curl sederhana tanpa generationConfig ekstra tetap jalan.
 */
async function callGeminiGenerateContent({ apiKey, model, parts, useSchema = true }) {
  const prevVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI;
  delete process.env.GOOGLE_GENAI_USE_VERTEXAI;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const restParts = parts.map((p) => {
    if (p.text != null) return { text: p.text };
    const inline = p.inline_data || p.inlineData;
    if (inline) {
      return {
        inline_data: {
          mime_type: inline.mime_type || inline.mimeType || 'image/png',
          data: inline.data,
        },
      };
    }
    return p;
  });

  // Budget besar: model latest bisa pakai thinking internal yang ikut maxOutputTokens
  const generationConfig = {
    temperature: 0.1,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
  };
  if (useSchema) {
    generationConfig.responseSchema = RESULT_SCHEMA;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: restParts }],
        generationConfig,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
      const reason = data?.error?.details?.[0]?.reason || data?.error?.status || '';
      const err = new Error(reason ? `${msg} [${reason}]` : msg);
      err.status = res.status;
      err.payload = data;
      err.retryWithoutSchema = useSchema && /invalid argument|INVALID_ARGUMENT|schema/i.test(msg);
      throw err;
    }

    const extracted = extractTextFromResponse(data);
    return { ...extracted, raw: data, model };
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
      'Gemini API key ditolak (401). Buat key baru di https://aistudio.google.com/apikey '
      + 'dan pastikan Generative Language API aktif.'
    );
  }
  if (err?.status === 404 || /no longer available|not found|NOT_FOUND/i.test(msg)) {
    return (
      `Model tidak tersedia (${msg}). Gunakan alias gemini-flash-latest — jangan pin ke 2.0/2.5/1.5.`
    );
  }
  return msg;
}

async function generateOcrContent(apiKey, model, parts) {
  try {
    return await callGeminiGenerateContent({ apiKey, model, parts, useSchema: true });
  } catch (err) {
    if (err.retryWithoutSchema) {
      return callGeminiGenerateContent({ apiKey, model, parts, useSchema: false });
    }
    throw err;
  }
}

export async function runGeminiVisionOcr(imageBuffer, mimeType = 'image/png') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY not configured', engine: 'gemini', text: '', results: [] };
  }

  const started = Date.now();
  try {
    const model = getModelName();
    const base64 = Buffer.isBuffer(imageBuffer)
      ? imageBuffer.toString('base64')
      : Buffer.from(imageBuffer).toString('base64');

    const parts = [
      { text: SYSTEM_PROMPT },
      {
        inline_data: {
          mime_type: mimeType || 'image/png',
          data: base64,
        },
      },
    ];

    const { text, finishReason, blockReason, raw } = await generateOcrContent(apiKey, model, parts);

    const latency = Date.now() - started;

    if (blockReason) {
      const error = `Gemini memblokir request (${blockReason})`;
      bumpGeminiUsage(latency, false, error);
      return {
        success: false, error, engine: 'gemini', text: text || '', results: [], latencyMs: latency, model, finishReason, blockReason,
      };
    }

    let results = normalizeResults(extractJson(text));
    if (!results.length) {
      results = parseLooseLines(text);
    }

    if (!results.length) {
      const preview = (text || '').slice(0, 500);
      const error = preview
        ? `No results parsed. Raw: ${preview}`
        : `No results parsed (empty text, finishReason=${finishReason || 'unknown'})`;
      bumpGeminiUsage(latency, false, error.slice(0, 240));
      return {
        success: false,
        error,
        engine: 'gemini',
        text: text || '',
        results: [],
        latencyMs: latency,
        model,
        finishReason,
        rawPreview: preview,
        candidateCount: raw?.candidates?.length ?? 0,
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
      finishReason,
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
      model: getModelName(),
    };
  }
}

export async function testGeminiConnection(apiKeyOverride) {
  const apiKey = (apiKeyOverride || getGeminiApiKey() || '').trim();
  if (!apiKey) return { ok: false, error: 'No API key set' };

  const started = Date.now();
  try {
    const model = getModelName();
    const prevVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI;
    delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    // Sama seperti curl yang berhasil — tanpa thinkingConfig
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (prevVertex !== undefined) process.env.GOOGLE_GENAI_USE_VERTEXAI = prevVertex;

    if (!res.ok) {
      const err = new Error(data?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const { text } = extractTextFromResponse(data);
    return { ok: true, latencyMs: Date.now() - started, sample: (text || '').slice(0, 40), model };
  } catch (err) {
    return {
      ok: false,
      error: friendlyAuthError(err),
      latencyMs: Date.now() - started,
      model: getModelName(),
    };
  }
}
