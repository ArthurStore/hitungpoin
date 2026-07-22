import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey, bumpGeminiUsage } from '../config/settingsStore.js';

const SYSTEM_PROMPT = `You are an OCR expert for Free Fire (Garena) esports match screenshots.
Analyze the image and extract match placement results.

Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{"results":[{"rank":1,"team_name":"TEAM","kills":0}]}

Rules:
- rank: integer 1-12 (placement / booyah = 1)
- team_name: team tag or player nickname as shown
- kills: integer kill count for that row (0 if unknown)
- Include up to 12 rows, sorted by rank ascending
- If this is a match history with individual players, use the nickname as team_name
- Ignore UI chrome, buttons, and unrelated text`;

function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
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

export async function runGeminiVisionOcr(imageBuffer, mimeType = 'image/png') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY not configured', engine: 'gemini', text: '', results: [] };
  }

  const started = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64 = imageBuffer.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType: mimeType || 'image/png', data: base64 } },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const text = response?.text || response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
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
    // Also expose plain text for legacy parsers
    const textLines = results.map((r) => `${r.rank} ${r.teamName} ${r.kills} Kill`).join('\n');

    return {
      success: true,
      engine: 'gemini',
      text: textLines,
      results,
      latencyMs: latency,
      raw: text,
    };
  } catch (err) {
    const latency = Date.now() - started;
    bumpGeminiUsage(latency, false, err.message);
    return {
      success: false,
      error: err.message || 'Gemini Vision failed',
      engine: 'gemini',
      text: '',
      results: [],
      latencyMs: latency,
    };
  }
}

export async function testGeminiConnection(apiKeyOverride) {
  const apiKey = apiKeyOverride || getGeminiApiKey();
  if (!apiKey) return { ok: false, error: 'No API key set' };

  const started = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Reply with exactly: OK',
      config: { maxOutputTokens: 16, temperature: 0 },
    });
    const text = (response?.text || '').trim();
    const latency = Date.now() - started;
    return { ok: true, latencyMs: latency, sample: text.slice(0, 40) };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - started };
  }
}
