// api/generate-questions.js
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
    const { yrkeskategori, samtalets_ton, fragetyper, fokusomraden, anpassningar } = req.body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }
    
    const systemPrompt = `Du är en expert på medarbetarsamtal och personalutveckling i svensk kommunal verksamhet, med specialkompetens inom Karlskoga kommun vars vision är "Välkomnande, kloka och innovativa Karlskoga".

Din uppgift är att generera kreativa, relevanta och engagerande frågor för medarbetarsamtal som:

1. KREATIVITET: Undvik standardfrågor - skapa unika, tankeväckande frågor som verkligen engagerar
2. YRKESSPECIFICITET: Anpassa frågorna till den specifika yrkeskategorin och dess unika utmaningar
3. KOMMUNVISION: Integrera Karlskogas vision naturligt i frågorna
4. PSYKOLOGISK SÄKERHET: Skapa frågor som bygger tillit och öppenhet
5. HANDLINGSKRAFT: Formulera frågor som leder till konkreta handlingsplaner

VIKTIGA PRINCIPER:
- Var specifik för yrkeskategorin - en förskollärares utmaningar skiljer sig från en IT-teknikers
- Balansera mellan att se bakåt (reflektion) och framåt (utveckling)
- Inkludera både "mjuka" (känslor, motivation) och "hårda" (mål, resultat) aspekter
- Ställ frågor som chefen faktiskt kan agera på svaren från
- Undvik ledande frågor eller frågor med inbyggda antaganden

För varje frågetyp, generera 4-6 frågor som är:
- Öppna (kan inte besvaras med ja/nej)
- Specifika för den valda yrkeskategorin
- Kopplade till kommunens vision där relevant
- Varierade i djup och perspektiv

Svara i JSON-format:
{
  "questions": {
    "öppna": ["Array av öppna, reflekterande frågor"],
    "konkreta": ["Array av specifika, mätbara frågor"],
    "reflekterande": ["Array av djupgående reflektionsfrågor"],
    "utveckling": ["Array av framtidsorienterade utvecklingsfrågor"],
    "framtid": ["Array av visionära framtidsfrågor"],
    "feedback": ["Array av feedbackfrågor till chefen"]
  },
  "fokusQuestions": {
    "arbetsmiljö": ["Array av arbetsmiljöfrågor om det valts"],
    "kompetensutveckling": ["Array av kompetensutvecklingsfrågor om det valts"],
    // ... etc för varje valt fokusområde
  },
  "tips": ["Array av 5-7 praktiska tips för samtalet"],
  "summary": "En sammanfattande text om samtalsunderlaget",
  "icebreakers": ["2-3 inledande frågor för att sätta en god ton"]
}`;

    const tonText = samtalets_ton.join(', ');
    const fragetyperText = fragetyper.join(', ');
    const fokusText = fokusomraden.length > 0 ? fokusomraden.join(', ') : 'inga specifika fokusområden valda';

    const userPrompt = `Skapa ett kreativt och skräddarsytt samtalsunderlag för:

YRKESKATEGORI: ${yrkeskategori}
ÖNSKAD TON: ${tonText}
FRÅGETYPER: ${fragetyperText}
FOKUSOMRÅDEN: ${fokusText}
SÄRSKILDA ÖNSKEMÅL: ${anpassningar || 'Inga särskilda anpassningar'}

VIKTIGT: 
- Tänk på vad som är unikt för en ${yrkeskategori} i en kommun
- Vilka utmaningar möter de dagligen?
- Hur kan de bidra till "Välkomnande, kloka och innovativa Karlskoga"?
- Vilka utvecklingsmöjligheter finns specifikt för denna roll?

Generera endast frågor för de valda frågetyperna: ${fragetyperText}
Generera endast fokusområdesfrågor för: ${fokusText}

Var kreativ och undvik generiska frågor!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2500,
        temperature: 0.85  // Högre temperatur för mer kreativitet
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse;
    
    try {
      aiResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback om JSON-parsing misslyckas
      aiResponse = {
        questions: {},
        fokusQuestions: {},
        tips: ["AI-svar kunde inte parsas korrekt. Försök igen."],
        summary: "Tekniskt fel uppstod. Vänligen försök igen.",
        icebreakers: []
      };
    }
    
    res.status(200).json(aiResponse);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Something went wrong',
      details: error.message
    });
  }
}
