// api/analyze-competence.js
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
    const { 
      medarbetarNamn, 
      roll, 
      avdelning, 
      anstallningstid,
      nuvarandeKompetenser,
      utmaningar,
      kompetensnivaer,
      karriarmal,
      utvecklingsomraden,
      inlarningsstilar,
      framtidaKompetensbehov,
      budget,
      tidsram
    } = req.body;
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }
    
    const systemPrompt = `Du är en expert på kompetensutveckling och karriärplanering i svensk kommunal verksamhet, med särskild kunskap om Karlskoga kommun vars vision är "Välkomnande, kloka och innovativa Karlskoga".

Din uppgift är att analysera medarbetarens nuläge, identifiera kompetensgap och skapa en konkret, genomförbar utvecklingsplan.

ANALYSRAMVERK:
1. **Gap-analys** - Jämför nuvarande kompetenser med karriärmål och framtida behov
2. **Prioritering** - Identifiera de viktigaste kompetenserna att utveckla först
3. **Realistisk planering** - Ta hänsyn till budget, tidsram och inlärningsstil
4. **Mätbarhet** - Sätt SMART-mål som går att följa upp
5. **Progression** - Bygg en stegvis plan från grund till mer avancerad nivå

UTVECKLINGSPLANEN SKA INNEHÅLLA:
- Konkreta, mätbara mål (SMART-formulerade)
- Specifika utbildningar, kurser eller aktiviteter
- Tidslinje med milstolpar
- Kostnadsuppskattningar (inom budgeten)
- Uppföljningspunkter

VIKTIGT:
- Var realistisk om vad som kan uppnås inom tidsramen
- Föreslå både interna (gratis) och externa resurser
- Anpassa till medarbetarens föredragna inlärningsstil
- Inkludera praktisk tillämpning, inte bara teoretisk kunskap
- Tänk på karriärutveckling inom kommunal sektor

Svara i JSON-format:
{
  "summary": "Kort sammanfattning av utvecklingsplanen",
  "gaps": ["Array av 3-5 identifierade kompetensgap"],
  "goals": ["Array av 3-5 SMART-formulerade utvecklingsmål"],
  "actions": [
    {
      "title": "3 månader",
      "items": ["Konkreta aktiviteter för första 3 månaderna"]
    },
    {
      "title": "6 månader",
      "items": ["Konkreta aktiviteter för 6 månader"]
    },
    {
      "title": "12 månader",
      "items": ["Konkreta aktiviteter för 12 månader"]
    }
  ],
  "resources": ["Array av 5-8 konkreta utbildningar/kurser med kostnadsuppskattning"],
  "tips": ["Array av 4-6 tips för framgångsrik kompetensutveckling"]
}`;

    const kompetensnivåerText = Object.entries(kompetensnivaer)
      .map(([område, nivå]) => `${område}: ${nivå}/10`)
      .join(', ');

    const userPrompt = `Skapa en kompetensutvecklingsplan för:

MEDARBETARE: ${medarbetarNamn || 'Anonym medarbetare'}
ROLL: ${roll}
AVDELNING: ${avdelning}
ANSTÄLLNINGSTID: ${anstallningstid} år

NUVARANDE KOMPETENSER:
${nuvarandeKompetenser}

${utmaningar ? `UTMANINGAR:\n${utmaningar}\n` : ''}

KOMPETENSKATTNING:
${kompetensnivåerText}

KARRIÄRMÅL:
${karriarmal}

ÖNSKADE UTVECKLINGSOMRÅDEN: ${utvecklingsomraden.join(', ')}
FÖREDRAGEN INLÄRNINGSSTIL: ${inlarningsstilar.join(', ')}

${framtidaKompetensbehov ? `FRAMTIDA KOMPETENSBEHOV I VERKSAMHETEN:\n${framtidaKompetensbehov}\n` : ''}

BUDGET: ${budget ? `${budget} kr` : 'Ingen specifik budget angiven'}
TIDSRAM: ${tidsram} månader

Skapa en realistisk, genomförbar och motiverande utvecklingsplan som hjälper medarbetaren att nå sina mål.`;

    async function callOpenAIWithRetry(maxRetries = 2) {
      for (let i = 0; i < maxRetries; i++) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
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
            const waitTime = Math.pow(2, i) * 1000;
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
        gaps: [],
        goals: [],
        actions: [],
        resources: [],
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
