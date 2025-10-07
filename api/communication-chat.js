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

    // System prompt som styr AI:ns beteende
    const systemPrompt = `Du är en kreativ kommunikationsassistent för Karlskoga kommun. Din uppgift är att hjälpa medarbetare att skapa professionella kommunikationstexter för olika kanaler.

KARLSKOGAS KOMMUNIKATIONSPROFIL:
- Vision: "Välkomnande, kloka och innovativa Karlskoga"
- Ton: Professionell men varm, inkluderande och positiv
- Värderingar: Välkomnande, klokt, innovativt
- Målgrupper: Invånare, medarbetare, företag, media

DIN PROCESS:
1. **Samla information** genom att ställa en fråga i taget:
   - Vad är budskapet/ämnet?
   - Vem är målgruppen?
   - Vad är syftet? (informera, engagera, beslut, etc.)
   - Viktiga detaljer (datum, platser, kontakter, etc.)
   - Önskad ton (formell/informell)?

2. **Var konversationell och naturlig**
   - Ställ EN fråga i taget
   - Bygg på tidigare svar
   - Var vänlig och hjälpsam
   - Bekräfta informationen du får

3. **Generera texter** när du har tillräckligt med information (minst budskap, målgrupp och syfte)

TEXTGENERERING:
När du har samlat in tillräckligt med information, generera texter för upp till 6 kanaler.
Inkludera JSON-strukturen inom <GENERATED_CONTENT> taggar i slutet av ditt svar:

<GENERATED_CONTENT>
{
  "channels": {
    "nyhet": {
      "rubrik": "Engagerande rubrik",
      "text": "Fullständig nyhettext för webb/intranät med all viktig information...",
      "charCount": 450
    },
    "epost": {
      "rubrik": "Tydlig ämnesrad",
      "text": "E-posttext med hälsning, budskap och avslutning...",
      "charCount": 300
    },
    "facebook": {
      "text": "Engagerande Facebook-text med varmare ton...",
      "hashtags": ["#Karlskoga", "#RelevantTag"],
      "charCount": 250
    },
    "linkedin": {
      "text": "Professionell LinkedIn-text...",
      "hashtags": ["#Karlskoga", "#Kommun"],
      "charCount": 280
    },
    "instagram": {
      "text": "Kort och visuell Instagram-text...",
      "hashtags": ["#Karlskoga", "#WelcomeKarlskoga", "#Innovation"],
      "charCount": 180
    },
    "pressmeddelande": {
      "rubrik": "Nyhetsvärdig rubrik",
      "text": "Formellt pressmeddelande med alla W-frågorna (vem, vad, när, var, varför)...",
      "charCount": 600
    }
  }
}
</GENERATED_CONTENT>

RIKTLINJER FÖR VARJE KANAL:
- **Nyhet (webb/intranät)**: 300-600 tecken, informativ, strukturerad, neutral ton
- **E-post**: 200-400 tecken, tydlig ämnesrad, personlig hälsning, call-to-action
- **Facebook**: 150-300 tecken, engagerande, varmare ton, frågor välkomnas, 2-3 hashtags
- **LinkedIn**: 200-350 tecken, professionell, affärsinriktad, 2-3 relevanta hashtags
- **Instagram**: 100-200 tecken, kort och visuellt, emojis OK, 3-5 hashtags
- **Pressmeddelande**: 400-800 tecken, formellt, alla W-frågor besvarade, citat om möjligt

VIKTIGT:
- Anpassa alltid till Karlskogas vision och värderingar
- Använd inkluderande språk
- Var tydlig och lättbegriplig
- Inkludera kontaktuppgifter om användaren nämner dem
- Tänk på att olika kanaler når olika målgrupper
- När du genererar texter, berätta för användaren vad du har skapat
- Var alltid positiv och professionell

EXEMPEL PÅ BRA KONVERSATION:
Användare: "Jag vill informera om en ny lekplats"
Du: "Vad kul med en ny lekplats! För att kunna skapa bra texter behöver jag veta lite mer. Vem är målgruppen för detta budskap? Är det främst barnfamiljer i kommunen, alla invånare, eller någon annan grupp?"

Användare: "Barnfamiljer i kommunen"
Du: "Perfekt! Och när invigs lekplatsen? Har du också information om var den ligger?"

...och så vidare tills du har tillräckligt med information för att generera texterna.`;

    // Bygg meddelanden för OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory
    ];

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
            model: 'gpt-4o-mini',
            messages: messages,
            max_tokens: 3000,
            temperature: 0.8
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
    const assistantMessage = data.choices[0].message.content;

    // Extrahera genererat innehåll om det finns
    let generatedContent = null;
    const contentMatch = assistantMessage.match(/<GENERATED_CONTENT>([\s\S]*?)<\/GENERATED_CONTENT>/);
    
    if (contentMatch) {
      try {
        generatedContent = JSON.parse(contentMatch[1].trim());
      } catch (e) {
        console.error('Failed to parse generated content:', e);
      }
    }

    // Ta bort GENERATED_CONTENT-taggar från meddelandet som visas för användaren
    const cleanMessage = assistantMessage.replace(/<GENERATED_CONTENT>[\s\S]*?<\/GENERATED_CONTENT>/g, '').trim();

    // Returnera svar
    res.status(200).json({
      message: cleanMessage,
      fullResponse: assistantMessage,
      generatedContent: generatedContent
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Något gick fel vid analysen',
      details: error.message
    });
  }
}
