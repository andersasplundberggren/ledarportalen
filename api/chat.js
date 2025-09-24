// api/chat.js
// Denna fil hanterar API-anropen säkert på Vercel

export default async function handler(req, res) {
  // Tillåt CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Hantera preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Endast tillåt POST-requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, lawTexts } = req.body;

    // Din API-nyckel sparas som environment variable (syns inte publikt)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }

    // Skapa kontext från lagtexter
    let context = "Du är en AI-assistent som hjälper personalledare med arbetsrättsliga frågor baserat på svensk lagstiftning.\n\n";
    
    if (lawTexts && Object.keys(lawTexts).length > 0) {
      context += "Tillgängliga lagtexter:\n";
      for (const [law, text] of Object.entries(lawTexts)) {
        // Begränsa text för att inte överstiga token-gränser
        const truncatedText = text.substring(0, 3000);
        context += `\n=== ${law.toUpperCase()} ===\n${truncatedText}\n`;
      }
      context += "\nSvara baserat på ovanstående lagtexter och var specifik om vilken lag du hänvisar till.";
    }

    // Anropa OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: context
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    res.status(200).json({
      response: data.choices[0].message.content
    });

  } catch (error) {
    console.error('Error:', error);
    
    res.status(500).json({
      error: 'Something went wrong',
      details: error.message
    });
  }
}
