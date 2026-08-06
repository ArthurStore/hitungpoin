/**
 * REST Gemini OCR — snake_case multimodal parts, multi-key rotation, 4-player roster.
 */
import {
  bumpGeminiUsage,
  getGeminiKeyRotationOrder,
  loadSettings,
  saveSettings,
} from '../config/settingsStore.js';

const SYSTEM_PROMPT_BIAS = `You are a Free Fire scoreboard OCR engine.
Extract EVERY team row visible in the screenshot into a pure JSON ARRAY. No markdown.

REQUIRED format (example):
[
  {
    "rank": 1,
    "team_name": "EXC",
    "nickname": "EXC|Captain",
    "kills": 8,
    "players": [
      { "nickname": "EXC|Captain", "kills": 3 },
      { "nickname": "EXC|P2", "kills": 2 },
      { "nickname": "EXC|P3", "kills": 2 },
      { "nickname": "EXC|P4", "kills": 1 }
    ]
  }
]

STRICT RULES:
1. rank = placement integer 1-12 (Booyah = 1).
2. team_name = clan/team tag shown on the row (NOT empty).
3. nickname = primary/representative player nick on that row (REQUIRED, never empty).
4. kills = TOTAL team eliminations for that row (REQUIRED integer >= 0). Read the kill column carefully.
5. players = up to 4 squad members if visible in match history / scoreboard expand.
   - Each player MUST have nickname + individual kills when readable.
   - If only 1 nick is visible, still return players:[{nickname, kills}] with team kills.
   - If 4 players are visible, return ALL 4.
6. Sum of player kills should match team kills when possible.
7. Max 12 teams, sorted by rank ascending.
8. Return ONLY the JSON array. Never return [] if any scoreboard rows are visible.
9. Do NOT invent players that are not on screen; but DO extract every visible nick + kill number.`;

const SYSTEM_PROMPT_LEAGUE = `You are a Free Fire CR LEAGUE / RANKLIST OCR engine.
The screenshot shows Rank | Team Name | Score (NO individual player nicknames).

Extract EVERY visible row into a pure JSON ARRAY. No markdown.

REQUIRED format:
[
  {
    "rank": 1,
    "team_name": "WERGOL",
    "nickname": "WERGOL",
    "kills": 57,
    "players": [{ "nickname": "WERGOL", "kills": 57 }]
  }
]

STRICT RULES:
1. rank = placement 1-12 from the Rank column.
2. team_name = EXACT team name string as shown (e.g. WERGOL, ADMIN, ARCN). REQUIRED, never empty.
3. nickname = SAME as team_name (CR League has no player nicks).
4. kills = the TOTAL SCORE number shown for that team (NOT elim kills — it is the score column). Integer >= 0.
5. players = single entry mirroring team_name + score.
6. Max 12 teams, sorted by rank ascending.
7. Return ONLY the JSON array. Read team names carefully — do not invent names.
8. Never return [] if ranklist rows are visible.`;

const DEFAULT_MODEL = 'gemini-flash-latest';

const RESULT_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      rank: { type: 'INTEGER' },
      team_name: { type: 'STRING' },
      nickname: { type: 'STRING' },
      kills: { type: 'INTEGER' },
      players: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            nickname: { type: 'STRING' },
            kills: { type: 'INTEGER' },
          },
          required: ['nickname', 'kills'],
        },
      },
    },
    required: ['rank', 'team_name', 'nickname', 'kills', 'players'],
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

function parseLooseLines(text) {
  if (!text) return [];
  const results = [];
  const seen = new Set();
  String(text).split(/\r?\n/).forEach((line) => {
    const m = line.match(
      /(?:^|\b)(\d{1,2})[.)\s:-]+([A-Za-z0-9_\-!?.|][A-Za-z0-9_\-!?.|\s]{0,32}?)\s+(\d{1,3})\b/
    );
    if (!m) return;
    const rank = parseInt(m[1], 10);
    if (rank < 1 || rank > 12 || seen.has(rank)) return;
    seen.add(rank);
    const nick = m[2].trim();
    const kills = parseInt(m[3], 10) || 0;
    results.push({
      rank,
      placement: rank,
      teamName: nick,
      nickname: nick,
      kills,
      players: [{ nickname: nick, kills }],
    });
  });
  return results.sort((a, b) => a.rank - b.rank);
}

function normalizePlayers(raw, fallbackNick, teamKills) {
  const list = Array.isArray(raw) ? raw
    : Array.isArray(raw?.players) ? raw.players
      : [];

  let players = list
    .map((p) => {
      if (typeof p === 'string') return { nickname: p.trim(), kills: 0 };
      return {
        nickname: String(p.nickname || p.name || p.player || p.ign || '').trim(),
        kills: parseInt(p.kills ?? p.kill ?? p.elim ?? 0, 10) || 0,
      };
    })
    .filter((p) => p.nickname)
    .slice(0, 4);

  if (!players.length && fallbackNick) {
    players = [{ nickname: fallbackNick, kills: teamKills || 0 }];
  }

  // Pad empty slots only when we have at least one nick (keep real data first)
  return players;
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
    .map((r) => {
      const teamName = String(r.team_name || r.teamName || r.clan || r.name || '').trim();
      let nickname = String(r.nickname || r.player || r.ign || r.representative || '').trim();
      let kills = parseInt(r.kills ?? r.kill ?? r.elim ?? r.eliminations ?? r.total_kills, 10);
      if (Number.isNaN(kills)) kills = 0;

      const players = normalizePlayers(
        r.players || r.members || r.roster || r.squad,
        nickname || teamName,
        kills
      );

      if (!nickname) nickname = players[0]?.nickname || teamName;

      // If team kills missing/0 but players have kills, sum them
      const playerKillSum = players.reduce((s, p) => s + (p.kills || 0), 0);
      if ((!kills || kills === 0) && playerKillSum > 0) kills = playerKillSum;

      // Ensure players[0] nick aligns with representative
      if (players.length && nickname && players[0].nickname !== nickname) {
        // keep players as-is; nickname is representative
      }

      return {
        rank: parseInt(r.rank ?? r.placement ?? r.place, 10),
        placement: parseInt(r.rank ?? r.placement ?? r.place, 10),
        teamName: teamName || nickname,
        nickname,
        kills,
        players,
      };
    })
    .filter((r) => r.rank >= 1 && r.rank <= 12 && (r.teamName || r.nickname))
    .sort((a, b) => a.rank - b.rank);
}

function getModelName() {
  const fromSettings = loadSettings().geminiModel;
  const fromEnv = process.env.GEMINI_MODEL;
  const raw = (fromSettings || fromEnv || DEFAULT_MODEL).trim();
  if (/^gemini-(1\.0|1\.5|2\.0|2\.5)(-|$)/i.test(raw) || raw === 'gemini-pro' || raw === 'gemini-flash') {
    return DEFAULT_MODEL;
  }
  return raw || DEFAULT_MODEL;
}

function extractTextFromResponse(data) {
  const candidates = data?.candidates || [];
  if (!candidates.length) {
    const block = data?.promptFeedback?.blockReason || data?.promptFeedback?.block_reason;
    return { text: '', finishReason: null, blockReason: block || 'NO_CANDIDATES' };
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

function isRetryableKeyError(err) {
  const msg = err?.message || '';
  const status = err?.status;
  return (
    status === 401 || status === 403 || status === 429 || status === 503
    || /RESOURCE_EXHAUSTED|rate limit|quota|UNAUTHENTICATED|PERMISSION_DENIED|Too Many Requests/i.test(msg)
  );
}

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

  const generationConfig = {
    temperature: 0.05,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
  };
  if (useSchema) generationConfig.responseSchema = RESULT_SCHEMA;

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

    return { ...extractTextFromResponse(data), raw: data, model };
  } finally {
    if (prevVertex !== undefined) process.env.GOOGLE_GENAI_USE_VERTEXAI = prevVertex;
  }
}

function friendlyAuthError(err) {
  const msg = err?.message || String(err);
  if (err?.status === 401 || /UNAUTHENTICATED|invalid authentication/i.test(msg)) {
    return 'Gemini API key ditolak (401). Cek Key 1–3 di Admin Panel.';
  }
  if (err?.status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) {
    return 'Quota/rate limit. Sistem akan coba key lain jika tersedia.';
  }
  if (err?.status === 404 || /no longer available|NOT_FOUND/i.test(msg)) {
    return `Model tidak tersedia (${msg}). Gunakan gemini-flash-latest.`;
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

export async function runGeminiVisionOcr(imageBuffer, mimeType = 'image/png', mode = 'cr_biasa') {
  const keyOrder = getGeminiKeyRotationOrder();
  if (!keyOrder.length) {
    return { success: false, error: 'GEMINI_API_KEY not configured (isi Key 1–3 di Admin)', engine: 'gemini', text: '', results: [] };
  }

  const started = Date.now();
  const model = getModelName();
  const base64 = Buffer.isBuffer(imageBuffer)
    ? imageBuffer.toString('base64')
    : Buffer.from(imageBuffer).toString('base64');

  const prompt = mode === 'cr_league' ? SYSTEM_PROMPT_LEAGUE : SYSTEM_PROMPT_BIAS;
  const parts = [
    { text: prompt },
    { inline_data: { mime_type: mimeType || 'image/png', data: base64 } },
  ];

  let lastError = null;

  for (const { key, slot } of keyOrder) {
    try {
      saveSettings({ geminiLastKeySlot: slot + 1 });
      const { text, finishReason, blockReason, raw } = await generateOcrContent(key, model, parts);
      const latency = Date.now() - started;

      if (blockReason) {
        lastError = `Gemini memblokir request (${blockReason})`;
        bumpGeminiUsage(latency, false, lastError, slot + 1);
        continue;
      }

      let results = normalizeResults(extractJson(text));
      if (!results.length) results = parseLooseLines(text);

      // CR League: force nickname = team_name when missing
      if (mode === 'cr_league') {
        results = results.map((r) => {
          const name = r.teamName || r.nickname || '';
          return {
            ...r,
            teamName: name,
            nickname: name,
            players: (r.players?.length ? r.players : [{ nickname: name, kills: r.kills || 0 }]),
          };
        });
      }

      if (!results.length) {
        lastError = (text || '').slice(0, 240)
          ? `No results parsed. Raw: ${(text || '').slice(0, 240)}`
          : `No results parsed (finishReason=${finishReason || 'unknown'})`;
        bumpGeminiUsage(latency, false, lastError.slice(0, 240), slot + 1);
        return {
          success: false,
          error: lastError,
          engine: 'gemini',
          text: text || '',
          results: [],
          latencyMs: latency,
          model,
          finishReason,
          rawPreview: (text || '').slice(0, 500),
          keySlot: slot + 1,
          candidateCount: raw?.candidates?.length ?? 0,
        };
      }

      bumpGeminiUsage(latency, true, '', slot + 1);
      const textLines = results.map((r) => {
        const roster = (r.players || []).map((p) => `${p.nickname}(${p.kills})`).join(', ');
        return `${r.rank} ${r.teamName} | nick:${r.nickname} | ${r.kills} Kill | [${roster}]`;
      }).join('\n');

      return {
        success: true,
        engine: 'gemini',
        text: textLines,
        results,
        latencyMs: latency,
        raw: text,
        model,
        finishReason,
        keySlot: slot + 1,
      };
    } catch (err) {
      lastError = friendlyAuthError(err);
      bumpGeminiUsage(Date.now() - started, false, lastError, slot + 1);
      if (isRetryableKeyError(err) && keyOrder.length > 1) {
        continue; // fallback next key
      }
      break;
    }
  }

  return {
    success: false,
    error: lastError || 'OCR failed',
    engine: 'gemini',
    text: '',
    results: [],
    latencyMs: Date.now() - started,
    model: getModelName(),
  };
}

export async function testGeminiConnection(apiKeyOverride) {
  const started = Date.now();
  const keys = apiKeyOverride?.trim()
    ? [{ key: apiKeyOverride.trim(), slot: 0 }]
    : getGeminiKeyRotationOrder();

  if (!keys.length) return { ok: false, error: 'No API key set' };

  const model = getModelName();
  let lastError = '';

  for (const { key, slot } of keys) {
    try {
      const prevVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI;
      delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (prevVertex !== undefined) process.env.GOOGLE_GENAI_USE_VERTEXAI = prevVertex;

      if (!res.ok) {
        const err = new Error(data?.error?.message || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      const { text } = extractTextFromResponse(data);
      saveSettings({ geminiLastKeySlot: slot + 1 });
      return {
        ok: true,
        latencyMs: Date.now() - started,
        sample: (text || '').slice(0, 40),
        model,
        keySlot: slot + 1,
      };
    } catch (err) {
      lastError = friendlyAuthError(err);
      if (isRetryableKeyError(err)) continue;
      break;
    }
  }

  return {
    ok: false,
    error: lastError || 'Connection failed',
    latencyMs: Date.now() - started,
    model: getModelName(),
  };
}
