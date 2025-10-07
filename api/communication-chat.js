// api/communication-chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { conversationHistory } = req.body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }

    // Begränsa historik till senaste 8 meddelanden för att minska token-användning
    const recentHistory = conversationHistory.slice(-8);

    // Kompakt system prompt
    const systemPrompt = `Du är kommunikationsassistent för Karlskoga kommun. Vision: "Välkomnande, kloka och innovativa Karlskoga".

UPPGIFT: Samla info genom korta frågor, sedan generera texter.

FRÅGA OM:
- Budskap/ämne
- Målgrupp
- Syfte
- Viktiga detaljer (datum, plats, kontakt)
- Önskad ton

När du har info (budskap + målgrupp + syfte + några detaljer), generera texter i denna JSON-struktur inom <GENERATED_CONTENT> taggar:

<GENERATED_CONTENT>
{
  "channels": {
    "nyhet": {"rubrik": "...", "text": "...", "charCount": 450},
    "epost": {"rubrik": "...", "text": "...", "charCount": 300},
    "facebook": {"text": "...", "hashtags": ["#Karlskoga", "..."], "charCount": 250},
    "linkedin": {"text": "...", "hashtags": ["#Karlskoga"], "charCount": 280},
    "instagram": {"text": "...", "hashtags": ["#Karlskoga", "..."], "charCount": 180},
    "pressmeddelande": {"rubrik": "...", "text": "...", "charCount": 600}
  }
}
</GENERATED_CONTENT>

RIKTLINJER:
- Nyhet: 300-600 tecken, informativ
- E-post: 200-400 tecken, personlig
- Facebook: 150-300 tecken, engagerande, 2-3 hashtags
- LinkedIn: 200-350 tecken, professionell, 2-3 hashtags  
- Instagram: 100-200 tecken, visuell, 3-5 hashtags
- Press: 400-800 tecken, formell, alla W-frågor

Var kortfattad, ställ EN fråga åt gången. När du genererar, berätta kort vad du skapar.`;

    // Bygg meddelanden
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory
    ];

    // API-anrop med kortare timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 sekunder

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          max_tokens: 2000, // Reducerad från 3000
          temperature: 0.7, // Mer konsekvent än 0.8
          presence_penalty: 0.3 // Undvik upprepningar
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error('För många förfrågningar. Vänta en stund och försök igen.');
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI error:', errorData);
        throw new Error(`OpenAI API fel: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message.content;

      // Extrahera genererat innehåll
      let generatedContent = null;
      const contentMatch = assistantMessage.match(/<GENERATED_CONTENT>([\s\S]*?)<\/GENERATED_CONTENT>/);
      
      if (contentMatch) {
        try {
          generatedContent = JSON.parse(contentMatch[1].trim());
        } catch (e) {
          console.error('JSON parse error:', e);
        }
      }

      // Ta bort GENERATED_CONTENT-taggar från visat meddelande
      const cleanMessage = assistantMessage
        .replace(/<GENERATED_CONTENT>[\s\S]*?<\/GENERATED_CONTENT>/g, '')
        .trim();

      // Returnera svar
      res.status(200).json({
        message: cleanMessage || assistantMessage,
        fullResponse: assistantMessage,
        generatedContent: generatedContent
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Timeout - försök med kortare meddelanden');
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Något gick fel',
      details: error.message
    });
  }
}

// Vercel config - öka timeout till max (hobby plan)
export const config = {
  maxDuration: 30
};
