// api/analyze-employee-input.js
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
    const { employeeData, context } = req.body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }
    
    const systemPrompt = `Du är en expert på medarbetarsamtal i svensk kommunal verksamhet. Din uppgift är att analysera medarbetarens input och ge konstruktiva råd för hur de kan förbereda sig inför sitt medarbetarsamtal.

SÄRSKILT VIKTIGT - Hantera vaga eller tomma svar kreativt:
- Om någon skriver "jag vet inte" eller lämnar fält tomma, ge konkreta förslag på vad de SKULLE kunna tänka på
- Ställ ledande frågor i form av förslag: "Du kanske kunde tänka på..."
- Ge exempel från vanliga kommunala arbetssituationer baserat på deras arbetsuppgifter
- Hjälp dem upptäcka styrkor de kanske inte ser själva

Exempel på kreativa svar:
- Tom om "vad fungerar bra": "Även om du inte direkt kan identifiera vad som fungerar, tänk på: Har du kollegor du samarbetar bra med? Finns det arbetsuppgifter du känner dig trygg med?"

- "Jag vet inte" om utveckling: "Det är okej att känna sig osäker! Baserat på dina arbetsuppgifter skulle du kunna utvecklas inom: digital kompetens, kommunikation med medborgare, eller kanske ledarskap?"

Fokusera på:
1. Kreativa förslag när svar är vaga
2. Konkreta exempel baserat på deras specifika arbetsuppgifter
3. Hjälp dem formulera tankar de kanske har men inte uttrycker
4. Diplomatiska formuleringar för känsliga ämnen
5. Rimliga och professionella råd

Ge ALDRIG råd om att:
- Kräva orealistiska förändringar
- Konfrontera på ett oprofessionellt sätt
- Ge upp eller lämna jobbet
- Klaga utan att föreslå lösningar

Du får en beskrivning av en persons arbetsuppgifter. 
1. Identifiera centrala kompetenser och typiska utmaningar kopplade till arbetsuppgifterna.
2. Generera 3–5 relevanta utvecklingsområden som är direkt kopplade till arbetsuppgifterna. 
Var kreativ och ge både "traditionella" och "oväntade" förslag. 
Ange för varje utvecklingsområde VAD det innebär, och HUR det kan utvecklas i praktiken.
Exempel:
- Arbetsuppgift: "budgetarbete och rapportering"
- Utvecklingsområden: "Avancerad Excel/kalkylprogram"; "Kreativa metoder för datavisualisering"; "Förhandlings- och presentationsförmåga".


Svara i JSON-format:
{
  "talkingPoints": ["Array av konkreta samtalsämnen baserat på deras input OCH kreativa förslag för vaga svar"],
  "aiInsights": ["Array av smarta observationer om deras situation"],
  "actionableAdvice": ["Array av konkreta handlingsråd baserat på deras arbetsuppgifter"], 
  "diplomaticPhrasing": ["Array av diplomatiska formuleringar"],
  "encouragement": "Uppmuntrande meddelande anpassat efter deras situation"
}`;

    const userPrompt = `Analysera denna medarbetares situation och var extra kreativ om svaren är vaga:

Yrkesroll: ${employeeData.roll}
Primära arbetsuppgifter: ${employeeData.arbetsuppgifter || "TOMMA - föreslå vad som kan ingå i denna roll"}
Arbetstillfredsställelse: ${employeeData.tillfredsställelse}/10
Vad som fungerar: ${employeeData.fungerar || "TOMT - ge kreativa förslag baserat på arbetsuppgifterna"}
Utmaningar: ${employeeData.utmaningar || "TOMT - föreslå vanliga utmaningar för denna typ av arbetsuppgifter"}
Utvecklingsönskemål: ${employeeData.utvecklingsomraden.length > 0 ? employeeData.utvecklingsomraden.join(', ') : "INGA VALDA - ge förslag på utvecklingsområden som passar arbetsuppgifterna"}
Konkreta mål: ${employeeData.mål || "TOMMA - föreslå mål som passar denna roll och arbetsuppgifter"}
Önskat stöd: ${employeeData.stöd || "TOMT - ge exempel på stöd som skulle passa denna typ av arbete"}
Framtidsplaner: ${employeeData.framtid || "TOMMA - hjälp dem tänka på karriärmöjligheter inom denna roll"}

Använd arbetsuppgifterna för att ge mer specifika och relevanta råd. Om något fält är tomt eller vagt (som "jag vet inte"), ge kreativa och specifika förslag på vad personen skulle kunna reflektera över eller ta upp under samtalet, baserat på deras specifika arbetsuppgifter.`;

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
        max_tokens: 2000,
        temperature: 0.95
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
      // Fallback om JSON-parsing misslyckas
      aiResponse = {
        talkingPoints: ["AI-svar kunde inte parsas korrekt. Försök igen."],
        aiInsights: [],
        actionableAdvice: [],
        diplomaticPhrasing: [],
        encouragement: "Tekniskt fel uppstod. Vänligen försök igen."
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
