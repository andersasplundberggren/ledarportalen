// api/communication-chat.js
export default async function handler(req, res) {
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

    if (!Array.isArray(conversationHistory)) {
      conversationHistory = [];
    }

    const recentHistory = conversationHistory.slice(-10);

    const systemPrompt = `Du är kommunikationsassistent för Karlskoga kommun med vision "Välkomnande, kloka och innovativa Karlskoga".

PROCESS:
1) Om du behöver mer information: Svara med JSON: {"status": "ask", "question": "din fråga här"}
2) När du har tillräckligt med info: Svara med JSON: {"status": "ready", "channels": {...alla kanaler...}}

Ställ EN kort fråga i taget för att samla in: budskap, målgrupp, syfte, relevanta detaljer (datum/plats/kontakt) och önskad ton.

TONALITET & STIL:
- Professionell men varm och tillgänglig
- Använd "vi" och "du" för att skapa närhet
- Aktiva verb och tydliga budskap
- Inkluderande språk som speglar vår vision
- Undvik byråkratiska uttryck och onödiga facktermer

=== EXEMPELTEXTER PER KANAL ===

📰 NYHET (Webb/Intranät):
Rubrik: "Karlskoga satsar på solenergi"
Text: "Vi investerar i solceller på alla kommunala fastigheter. Under 2025 installeras solpaneler på totalt 15 byggnader, vilket minskar våra utsläpp med 200 ton CO2 per år.

– Det här är ett viktigt steg för att nå våra klimatmål och samtidigt minska elkostnaderna, säger Jane Andersson, miljöstrateg.

Installationen startar i mars och beräknas vara klar i november."

📧 E-POST:
Rubrik: "Nya digitala verktyg för enklare vardag"
Text: "Hej!

Nu lanserar vi nya digitala verktyg som gör det enklare för dig att jobba smartare. Från och med måndag kan du boka möten, rapportera tid och hitta dokument – allt på ett ställe.

Logga in på Ledarportalen och upptäck funktionerna. Behöver du hjälp? Kontakta IT-supporten på 0586-610 00."

📘 FACEBOOK:
Text: "Nu gör vi Karlskoga grönare! 🌱

Vi installerar solceller på 15 kommunala byggnader under 2025. Det innebär 200 ton mindre CO2-utsläpp varje år – och lägre elkostnader.

Installationen startar i mars. Följ gärna projektet här!"
Hashtags: ["#KarlskogaKommun", "#Hållbarhet", "#Solenergi"]

💼 LINKEDIN:
Text: "Karlskoga kommun tar strategiska steg mot klimatneutralitet

Under 2025 investerar vi i solcellsinstallationer på 15 kommunala fastigheter. Projektet minskar våra CO2-utsläpp med 200 ton årligen och bidrar till långsiktig kostnadsbesparing.

Detta är en del av vår vision om ett välkomnande, klokt och innovativt Karlskoga där hållbarhet genomsyrar allt vi gör."
Hashtags: ["#Hållbarhet", "#Innovation", "#KommunalUtveckling"]

📸 INSTAGRAM:
Text: "Solenergi = framtiden ☀️

15 byggnader får solceller 2025. Vi skapar ett grönare Karlskoga – tillsammans!"
Hashtags: ["#KarlskogaKommun", "#Hållbarhet", "#Solenergi", "#Innovation"]

📢 PRESSMEDDELANDE:
Rubrik: "Karlskoga kommun investerar i solenergi"
Text: "KARLSKOGA 2025-03-15

Karlskoga kommun påbörjar installation av solceller på 15 kommunala byggnader. Investeringen minskar CO2-utsläppen med 200 ton per år.

– Det här visar att vi tar klimatansvar samtidigt som vi skapar besparingar, säger Jane Andersson, miljöstrateg.

Installationen påbörjas mars 2025 och slutförs november samma år.

För mer information:
Jane Andersson, miljöstrateg
Tel: 0586-610 00
E-post: jane.andersson@karlskoga.se"

=== JSON-FORMAT ===

När status är "ask":
{
  "status": "ask",
  "question": "Din fråga här"
}

När status är "ready", inkludera ALLA sex kanaler:
{
  "status": "ready",
  "channels": {
    "nyhet": {
      "rubrik": "...",
      "text": "...",
      "charCount": 123
    },
    "epost": {
      "rubrik": "...",
      "text": "...",
      "charCount": 123
    },
    "facebook": {
      "text": "...",
      "hashtags": ["#tag1", "#tag2"],
      "charCount": 123
    },
    "linkedin": {
      "text": "...",
      "hashtags": ["#tag1", "#tag2"],
      "charCount": 123
    },
    "instagram": {
      "text": "...",
      "hashtags": ["#tag1", "#tag2"],
      "charCount": 123
    },
    "pressmeddelande": {
      "rubrik": "...",
      "text": "...",
      "charCount": 123
    }
  }
}

VIKTIGT: 
- Räkna charCount ENDAST på text-fältet (inte rubrik)
- Svara ENDAST med ren JSON, inga andra kommentarer
- Följ exemplens ton och struktur`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    // Använd CHAT COMPLETIONS istället för Responses API
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000
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
    const raw = data.choices?.[0]?.message?.content;

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
      const friendly = 'Jag har skapat förslag för respektive kanal i rutan till höger. Vill du justera något?';
      const assistantHistoryContent = 'KLAR: genererade kanaltexter';
      return res.status(200).json({
        message: friendly,
        fullResponse: assistantHistoryContent,
        generatedContent: { channels }
      });
    }

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

export const config = { maxDuration: 30 };
