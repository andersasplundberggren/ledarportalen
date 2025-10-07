// api/communication-chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { conversationHistory } = req.body || {};
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Saknar OPENAI_API_KEY i Vercel', details: 'Env saknas' });
    }
    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: 'Invalid conversation history' });
    }

    const recentHistory = conversationHistory.slice(-10);

    const systemPrompt = `Du är kommunikationsassistent för Karlskoga kommun med vision "Välkomnande, kloka och innovativa Karlskoga".

PROCESS:
1. Ställ EN fråga i taget för att samla: budskap, målgrupp, syfte, detaljer (datum/plats/kontakt), ton
2. När du har minst: budskap + målgrupp + syfte → generera texter

VIKTIGT:
- Korta, tydliga texter
- Anpassa ton till målgrupp
- Inkludera relevanta detaljer
- Räkna tecken korrekt
- När du genererar, följ exakt JSON-schemat (inga extra fält).`;

    // Bygg meddelanden
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map(m => ({ role: m.role, content: m.content })),
      {
        role: 'system',
        content:
          'När du har tillräckligt med information ska du endast svara med JSON enligt givet schema. Inga förklaringar, inga taggar.'
      }
    ];

    // JSON-schema för output
    const jsonSchema = {
      name: "KommunikationOutput",
      schema: {
        type: "object",
        properties: {
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
                required: ["rubrik", "text", "charCount"]
              },
              epost: {
                type: "object",
                properties: {
                  rubrik: { type: "string" },
                  text: { type: "string" },
                  charCount: { type: "integer" }
                },
                required: ["rubrik", "text", "charCount"]
              },
              facebook: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  charCount: { type: "integer" }
                },
                required: ["text", "charCount"]
              },
              linkedin: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  charCount: { type: "integer" }
                },
                required: ["text", "charCount"]
              },
              instagram: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  charCount: { type: "integer" }
                },
                required: ["text", "charCount"]
              },
              pressmeddelande: {
                type: "object",
                properties: {
                  rubrik: { type: "string" },
                  text: { type: "string" },
                  charCount: { type: "integer" }
                },
                required: ["rubrik", "text", "charCount"]
              }
            },
            additionalProperties: false
          }
        },
        required: ["channels"],
        additionalProperties: false
      },
      strict: true
    };

    // Anropa OpenAI Responses API (stabilt JSON-svar)
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 28000);

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // fungerar för JSON-formaterade svar
        input: messages,
        response_format: { type: 'json_schema', json_schema: jsonSchema },
        temperature: 0.7,
        max_output_tokens: 2000
      }),
      signal: controller.signal
    }).catch(e => {
      throw e.name === 'AbortError' ? new Error('Timeout - AI svarade inte i tid') : e;
    });

    clearTimeout(to);

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: 'OpenAI fel', details: t });
    }

    const data = await resp.json();

    // Responses API returnerar svaret i data.output[0].content[0].text (eller data.output_text).
    const raw = data.output_text || (
      data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text
    ) || null;

    if (!raw) {
      return res.status(500).json({ error: 'Tomt AI-svar' });
    }

    let generatedContent;
    try {
      generatedContent = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Kunde inte tolka AI-JSON', details: raw.slice(0, 300) });
    }

    // Skapa vänligt meddelande att visa i chatten
    const message = 'Jag har skapat förslag för respektive kanal i rutan till höger. Vill du justera ton, längd eller målgrupp?';

    return res.status(200).json({
      message,
      fullResponse: raw,
      generatedContent
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Något gick fel',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

export const config = { maxDuration: 30 };
