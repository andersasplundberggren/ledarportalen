// api/analyze-recruitment.js
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
    const { annonstext, cvText, pbText, fokusomraden, anpassningar } = req.body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }
    
    const systemPrompt = `Du är en expert på rekrytering och kompetensanalys i svensk kommunal verksamhet, med särskild kunskap om Karlskoga kommun vars vision är "Välkomnande, kloka och innovativa Karlskoga".

Din uppgift är att analysera kandidatdokument mot en jobbannons och skapa ett professionellt intervjuunderlag för anställande chef.

ANALYSRAMVERK:
1. **Matchningsanalys** - Hur väl matchar kandidaten jobbkraven?
2. **Styrkor** - Vad är kandidatens tydligaste styrkor?
3. **Utvecklingsområden** - Var finns gap eller oklarheter?
4. **Kulturell passform** - Passar kandidaten Karlskogas vision och värderingar?
5. **Motivation & drivkrafter** - Vad driver kandidaten?
6. **Riskbedömning** - Finns det varningssignaler eller oklarheter?

INTERVJUFRÅGOR:
- Skapa 8-12 specifika intervjufrågor baserat på analysen
- Fokusera på att undersöka gaps och verifiera styrkor
- Inkludera situationsbaserade frågor (STAR-metoden)
- Ställ frågor om motivation och värderingar
- Anpassa till kommunens kontext

VIKTIGT:
- Var objektiv och basera analys på fakta från dokumenten
- Identifiera både styrkor OCH potentiella utmaningar
- Ge konkreta exempel från CV/personligt brev
- Tänk på mångfald och inkludering
- Undvik bias baserat på kön, ålder, ursprung etc.

Svara i JSON-format:
{
  "summary": "Kort sammanfattning av kandidaten och matchning",
  "candidateSummary": "2-3 meningar om kandidatens bakgrund och profil",
  "strengths": ["Array av 4-6 konkreta styrkor med exempel"],
  "concerns": ["Array av 3-5 områden att undersöka närmare"],
  "culturalFit": "Bedömning av kulturell passform mot Karlskogas vision",
  "interviewQuestions": ["Array av 8-12 specifika intervjufrågor"],
  "tips": ["Array av 4-6 tips för intervjun"]
}`;

    const fokusText = fokusomraden.join(', ');
    const userPrompt = `Analysera denna kandidat mot jobbannonsen:

=== JOBBANNONS ===
${annonstext}

=== CV ===
${cvText}

${pbText ? `=== PERSONLIGT BREV ===\n${pbText}` : ''}

FOKUSOMRÅDEN: ${fokusText}
${anpassningar ? `SÄRSKILDA ÖNSKEMÅL: ${anpassningar}` : ''}

Skapa ett professionellt och balanserat intervjuunderlag.`;

    // Retry-funktion för rate limits
    async function callOpenAIWithRetry(maxRetries = 2) {
      for (let i = 0; i < maxRetries; i++) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',  // Ändrat från gpt-4
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        });

        if (response.status === 429) {
          if (i < maxRetries - 1) {
            const waitTime = Math.pow(2, i) * 1000; // 1s, 2s
            console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${i + 1}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else {
            throw new Error('Rate limit nådd. Vänta en minut och försök igen.');
          }
        }

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
        }

        return response;
      }
    }

    const response = await callOpenAIWithRetry();
    const data = await response.json();
    let aiResponse;
    
    try {
      aiResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      aiResponse = {
        summary: "AI-svar kunde inte parsas korrekt.",
        candidateSummary: "",
        strengths: [],
        concerns: [],
        culturalFit: "",
        interviewQuestions: [],
        tips: []
      };
    }
    
    res.status(200).json(aiResponse);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Något gick fel vid analysen',
      details: error.message
    });
  }
}
