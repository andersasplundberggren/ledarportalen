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
    
    // Skapa intelligent prompt för medarbetaranalys
    const systemPrompt = `Du är en expert på medarbetarsamtal i svensk kommunal verksamhet. Din uppgift är att analysera medarbetarens input och ge konstruktiva råd för hur de kan förbereda sig inför sitt medarbetarsamtal.

Fokusera på:
1. Praktiska råd för kommunikation
2. Diplomatiska formuleringar för känsliga ämnen  
3. Konkreta förslag baserat på deras situation
4. Rimliga och professionella råd

Ge ALDRIG råd om att:
- Kräva orealistiska förändringar
- Konfrontera på ett oprofessionellt sätt
- Ge upp eller lämna jobbet
- Klaga utan att föreslå lösningar

Svara i JSON-format:
{
  "aiInsights": ["Array av smarta observationer om deras situation"],
  "actionableAdvice": ["Array av konkreta handlingsråd"], 
  "diplomaticPhrasing": ["Array av diplomitiska formuleringar"],
  "encouragement": "Uppmuntrande meddelande anpassat efter deras situation"
}`;

    const userPrompt = `Analysera denna medarbetares situation:
Yrkesroll: ${employeeData.roll}
Arbetstillfredsställelse: ${employeeData.tillfredsställelse}/10
Vad som fungerar: ${employeeData.fungerar}
Utmaningar: ${employeeData.utmaningar}
Utvecklingsönskemål: ${employeeData.utvecklingsomraden.join(', ')}
Konkreta mål: ${employeeData.mål}
Önskat stöd: ${employeeData.stöd}
Framtidsplaner: ${employeeData.framtid}`;

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
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);
    
    res.status(200).json(aiResponse);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Something went wrong',
      details: error.message
    });
  }
}
