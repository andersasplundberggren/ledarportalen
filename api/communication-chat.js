// api/communication-chat.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    let { conversationHistory } = body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Saknar OPENAI_API_KEY i Vercel',
        details: 'Lägg till env-variabeln och deploya om'
      });
    }

    // Var tolerant: om historik saknas eller fel typ -> tom lista
    if (!Array.isArray(conversationHistory)) {
      conversationHistory = [];
    }

    // Begränsa sammanhang
    const recentHistory = conversationHistory.slice(-10);

    // --- Prompts ---
    const systemPrompt = `Du är kommunikationsassistent för Karlskoga kommun med vision "Välkomnande, kloka och innovativa Karlskoga".

PROCESS:
1) Ställ EN kort fråga i taget för att samla in: budskap, målgrupp, syfte, och relevanta detaljer (datum/plats/kontakt) samt önskad ton.
2) När du har minst budskap + målgrupp + syfte => generera texter för kanalerna.

REGLER:
- Korta, tydliga, inkluderande formuleringar i linje med visionen.
- Anpassa ton till målgrupp.
- Inkludera relevanta fakta.
- Räkna tecken på textfält (inte rubrik).
- Svara ENDAST som strikt JSON enligt schemat. Inga andra fält eller kommentarer.`;

    // Gör om frontends historik (user/assistant) till minimalt format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
    ];

    // --- JSON-schema: två lägen: "ask" (ställ fråga) eller "ready" (generera texter) ---
    const jsonSchema = {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ask", "ready"] },
        // Om status = ask
        question: { type: "string" },
        // Om status = ready
        channels: {
          type: "object",
          properties: {
            nyhet: {
              type: "object",
              properties: {
                rubrik: { type: "string" },
                text: { type: "string" },
                charCount: { type: "integer" }
              },
              required: ["rubrik", "text", "charCount"],
              additionalProperties: false
            },
            epost: {
              type: "object",
              properties: {
                rubrik: { type: "string" },
                text: { type: "string" },
                charCount: { type: "integer" }
              },
              required: ["rubrik", "text", "charCount"],
              additionalProperties: false
            },
            facebook: {
              type: "object",
              properties: {
                text: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                charCount: { type: "integer" }
              },
              required: ["text", "charCount"],
              additionalProperties: false
            },
            linkedin: {
              type: "object",
              properties: {
                text: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                charCount: { type: "integer" }
              },
              required: ["text", "charCount"],
              additionalProperties: false
            },
            instagram: {
              type: "object",
              properties: {
                text: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                charCount: { type: "integer" }
              },
              required: ["text", "charCount"],
              additionalProperties: false
            },
            pressmeddelande: {
              type: "object",
              properties: {
                rubrik: { type: "string" },
                text: { type: "string" },
                charCount: { type: "integer" }
              },
              required: ["rubrik", "text", "charCount"],
              additionalProperties: false
            }
          },
          additionalProperties: false
        }
      },
      required: ["status"],
      additionalProperties: false,
      oneOf: [
        { required: ["status", "question"] },
        { required: ["status", "channels"] }
      ]
    };

    // --- OpenAI Responses API-anrop (UPPDATERAD SYNTAX MED NAME) ---
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: messages,
        // ÄNDRAT: Lagt till name och strict flaggor
        text: {
          format: { 
            type: 'json_schema',
            name: 'KommunikationFlow',
            schema: jsonSchema,
            strict: true
          }
        },
        temperature: 0.7,
        max_output_tokens: 2000
      }),
      signal: controller.signal
    }).catch(e => {
      throw e.name === 'AbortError' ? new Error('Timeout - AI svarade inte i tid') : e;
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: 'OpenAI fel', details: t });
    }

    const data = await resp.json();

    // Hämta textutdata
    const raw =
      data.output_text ||
      (
        data.output &&
        data.output[0] &&
        data.output[0].content &&
        data.output[0].content[0] &&
        data.output[0].content[0].text
      ) ||
      null;

    if (!raw) {
      return res.status(500).json({ error: 'Tomt AI-svar' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: 'Kunde inte tolka AI-JSON',
        details: String(raw).slice(0, 400)
      });
    }

    // Hjälpfunktion: säkerställ rimlig struktur + beräkna charCount
    function normalizeChannels(channels) {
      if (!channels || typeof channels !== 'object') return null;

      const out = {};
      const ensureArray = (arr) => Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];

      const setCount = (obj) => {
        if (!obj) return;
        if (typeof obj.text === 'string') {
          obj.charCount = obj.text.length;
        } else {
          obj.charCount = 0;
        }
      };

      if (channels.nyhet) {
        out.nyhet = {
          rubrik: String(channels.nyhet.rubrik || ''),
          text: String(channels.nyhet.text || ''),
          charCount: 0
        };
        setCount(out.nyhet);
      }
      if (channels.epost) {
        out.epost = {
          rubrik: String(channels.epost.rubrik || ''),
          text: String(channels.epost.text || ''),
          charCount: 0
        };
        setCount(out.epost);
      }
      if (channels.facebook) {
        out.facebook = {
          text: String(channels.facebook.text || ''),
          hashtags: ensureArray(channels.facebook.hashtags),
          charCount: 0
        };
        setCount(out.facebook);
      }
      if (channels.linkedin) {
        out.linkedin = {
          text: String(channels.linkedin.text || ''),
          hashtags: ensureArray(channels.linkedin.hashtags),
          charCount: 0
        };
        setCount(out.linkedin);
      }
      if (channels.instagram) {
        out.instagram = {
          text: String(channels.instagram.text || ''),
          hashtags: ensureArray(channels.instagram.hashtags),
          charCount: 0
        };
        setCount(out.instagram);
      }
      if (channels.pressmeddelande) {
        out.pressmeddelande = {
          rubrik: String(channels.pressmeddelande.rubrik || ''),
          text: String(channels.pressmeddelande.text || ''),
          charCount: 0
        };
        setCount(out.pressmeddelande);
      }

      return out;
    }

    if (parsed.status === 'ask') {
      const question = String(parsed.question || 'Vad är huvudsakligt budskap? Vem är målgruppen?');
      const assistantHistoryContent = `FRÅGA: ${question}`;
      return res.status(200).json({
        message: question,
        fullResponse: assistantHistoryContent,
        generatedContent: null
      });
    }

    if (parsed.status === 'ready') {
      const channels = normalizeChannels(parsed.channels);
      if (!channels || Object.keys(channels).length === 0) {
        return res.status(500).json({
          error: 'Saknar kanalinnehåll trots status=ready'
        });
      }
      const friendly = 'Jag har skapat förslag för respektive kanal i rutan till höger. Vill du justera ton, längd eller målgrupp?';
      const assistantHistoryContent = 'KLAR: genererade kanaltexter';
      return res.status(200).json({
        message: friendly,
        fullResponse: assistantHistoryContent,
        generatedContent: { channels }
      });
    }

    // Om något oväntat
    return res.status(500).json({
      error: 'Oväntad status i AI-svar',
      details: parsed
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Något gick fel',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Vercel timeout-skydd
export const config = { maxDuration: 30 };
