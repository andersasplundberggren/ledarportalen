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
      console.error('Missing API key');
      throw new Error('API key not configured');
    }

    // Validera input
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      throw new Error('Invalid conversation history');
    }

    // Begränsa till senaste 10 meddelanden
    const recentHistory = conversationHistory.slice(-10);

    // System prompt
    const systemPrompt = `Du är kommunikationsassistent för Karlskoga kommun med vision "Välkomnande, kloka och innovativa Karlskoga".

PROCESS:
1. Ställ EN fråga i taget för att samla: budskap, målgrupp, syfte, detaljer (datum/plats/kontakt), ton
2. När du har minst: budskap + målgrupp + syfte → generera texter

GENERERA TEXTER:
Skapa JSON inom <GENERATED_CONTENT> taggar:

<GENERATED_CONTENT>
{
  "channels": {
    "nyhet": {"rubrik": "Rubrik här", "text": "Nyhettext 300-500 tecken", "charCount": 400},
    "epost": {"rubrik": "Ämnesrad", "text": "E-posttext 250-400 tecken", "charCount": 300},
    "facebook": {"text": "Facebook-text 150-250 tecken", "hashtags": ["#Karlskoga"], "charCount": 200},
    "linkedin": {"text": "LinkedIn-text 200-300 tecken", "hashtags": ["#Karlskoga"], "charCount": 250},
    "instagram": {"text": "Instagram-text 100-180 tecken", "hashtags": ["#Karlskoga"], "charCount": 150},
    "pressmeddelande": {"rubrik": "Pressrubrik", "text": "Presstext 400-700 tecken", "charCount": 550}
  }
}
</GENERATED_CONTENT>

VIKTIGT:
- Använd Karlskogas värderingar
- Korta, tydliga texter
- Anpassa ton till målgrupp
- Inkludera relevanta detaljer
- Räkna tecken korrekt`;

    console.log(`Processing ${recentHistory.length} messages`);

    // Bygg meddelanden för OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // API-anrop med timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          max_tokens: 2500,
          temperature: 0.7
        }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', fetchError);
      if (fetchError.name === 'AbortError') {
        throw new Error('Timeout - AI svarade inte i tid');
      }
      throw new Error('Kunde inte kontakta OpenAI');
    }

    clearTimeout(timeoutId);

    // Hantera OpenAI fel
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI error ${response.status}:`, errorText);
      
      if (response.status === 429) {
        throw new Error('För många förfrågningar. Vänta 30 sekunder.');
      }
      if (response.status === 401) {
        throw new Error('API-nyckel är ogiltig');
      }
      throw new Error(`OpenAI fel: ${response.status}`);
    }

    // Parse svar
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response:', data);
      throw new Error('Ogiltigt svar från AI');
    }

    const assistantMessage = data.choices[0].message.content;
    console.log('AI response length:', assistantMessage.length);

    // Extrahera genererat innehåll
    let generatedContent = null;
    const contentMatch = assistantMessage.match(/<GENERATED_CONTENT>([\s\S]*?)<\/GENERATED_CONTENT>/);
    
    if (contentMatch) {
      try {
        const jsonStr = contentMatch[1].trim();
        generatedContent = JSON.parse(jsonStr);
        console.log('Successfully parsed generated content');
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('JSON string:', contentMatch[1].substring(0, 200));
        // Fortsätt ändå utan genererat innehåll
      }
    }

    // Ta bort GENERATED_CONTENT-taggar från visat meddelande
    const cleanMessage = assistantMessage
      .replace(/<GENERATED_CONTENT>[\s\S]*?<\/GENERATED_CONTENT>/g, '')
      .trim();

    // Returnera svar
    const responseData = {
      message: cleanMessage || 'Jag har skapat texterna åt dig!',
      fullResponse: assistantMessage,
      generatedContent: generatedContent
    };

    console.log('Sending response, has content:', !!generatedContent);
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      error: 'Något gick fel',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export const config = {
  maxDuration: 30
};
