// api/generate-communication.js
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
      budskap, 
      varfor, 
      malgrupper, 
      toner, 
      bakgrund,
      nyckelord,
      tidpunkt,
      kanaler 
    } = req.body;
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }

    // ============================================================================
    // EXEMPEL-MALLAR FÖR VARJE KOMMUNIKATIONSKANAL
    // Redigera dessa mallar för att anpassa hur AI genererar texter
    // ============================================================================
    
    const CHANNEL_TEMPLATES = {
      nyhet: {
        beskrivning: "Nyhet för webbplats eller intranät",
        struktur: "Rubrik + ingress + brödtext + avslutning",
        maxLangd: "400-600 ord",
        exempelMall: `
RUBRIK: Engagerande rubrik som fångar uppmärksamheten

INGRESS: En kort sammanfattning som ger läsaren de viktigaste punkterna direkt. 2-3 meningar.

BRÖDTEXT:
- Förklara vad som händer/har hänt
- Varför det är viktigt
- Vem det påverkar
- Konkreta exempel eller citat vid behov

AVSLUTNING: 
Vad händer härnäst? Länk till mer information eller kontaktperson.`,
        exempelText: `
Rubrik: Ny digital plattform förbättrar medborgarservice i Karlskoga

Karlskoga kommun lanserar en helt ny digital plattform som gör det enklare för medborgare att nå kommunens tjänster. Plattformen innebär kortare handläggningstider och bättre tillgänglighet.

Den nya plattformen är ett resultat av kommunens satsning på digitalisering och innovation. "Vi vill göra det så enkelt som möjligt för våra medborgare att få hjälp när de behöver det", säger Eva Andersson, digitaliseringschef.

Plattformen lanseras den 15 januari och kommer gradvis att utökas med fler tjänster under våren.`
      },

      epost: {
        beskrivning: "E-postutskick till målgrupp",
        struktur: "Ämnesrad + hälsning + budskap + avslutning + signatur",
        maxLangd: "200-300 ord",
        exempelMall: `
ÄMNESRAD: Tydlig och engagerande - max 50 tecken

Hej [målgrupp],

INLEDNING: En kort mening som skapar kontext.

BUDSKAP: 
- Huvudinformation i 2-3 korta stycken
- Använd punktlistor för tydlighet vid behov
- Var konkret och handlingsinriktad

AVSLUTNING:
Vad ska läsaren göra? Call-to-action.

Med vänlig hälsning,
[Avdelning/Organisation]`,
        exempelText: `
Ämnesrad: Viktigt: Nya rutiner från 1 februari

Hej kollegor,

Vi vill informera er om nya rutiner för tidsrapportering som träder i kraft den 1 februari.

De nya rutinerna innebär att:
- Tidsrapportering ska ske varje fredag
- Nytt system via intranätet
- Utbildning erbjuds den 25-26 januari

Läs mer och anmäl dig till utbildning via intranätet.

Med vänlig hälsning,
HR-avdelningen, Karlskoga kommun`
      },

      facebook: {
        beskrivning: "Facebook-inlägg",
        struktur: "Engagerande inledning + budskap + call-to-action + hashtags",
        maxLangd: "100-200 ord (kortare = bättre)",
        exempelMall: `
INLEDNING: Fånga uppmärksamheten direkt! Emoji kan användas. 🌟

BUDSKAP: 
1-2 korta stycken. Var personlig och engagerande. 
Ställ gärna en fråga till läsarna.

CALL-TO-ACTION: 
Vad vill du att läsarna ska göra? (Läs mer, kommentera, dela)

#Hashtag1 #Hashtag2 #Hashtag3`,
        exempelText: `
Spännande nyheter från Karlskoga kommun! 🎉

Vi lanserar en helt ny digital plattform som gör det enklare att nå våra tjänster. Snabbare svar, enklare ärenden och tillgängligt dygnet runt!

Vad tycker du är viktigast i kommunens digitala tjänster? Kommentera gärna! 💬

Läs mer på karlskoga.se

#Karlskoga #DigitalKommun #Medborgarservice`
      },

      linkedin: {
        beskrivning: "LinkedIn-inlägg",
        struktur: "Professionell ton + värde för läsaren + insikter",
        maxLangd: "150-300 ord",
        exempelMall: `
HOOK: Börja med något som fångar professionella läsares intresse.

KONTEXT: Varför är detta relevant nu?

BUDSKAP:
- Fokusera på värde och lärdom
- Professionell men tillgänglig ton
- Konkreta exempel eller data

REFLEKTION: 
Vad betyder detta för framtiden/branschen?

[Sparsamma hashtags - max 3]`,
        exempelText: `
Karlskoga kommun tar nästa steg mot en datadrivet beslutsfattande 📊

I en tid där digitaliseringen accelererar har vi investerat i en ny plattform för medborgarservice. Men det handlar om mer än teknik - det handlar om att skapa värde för de vi är till för.

Genom att förenkla tillgången till kommunala tjänster frigör vi tid för medborgare och medarbetare. Första månadens resultat visar 30% kortare handläggningstider.

Nyckellärdomar:
- Involvera användarna från dag ett
- Iterera baserat på feedback
- Fokusera på värde, inte bara teknik

#PublicSector #Digitalisering #Innovation`
      },

      instagram: {
        beskrivning: "Instagram-inlägg (bildtext)",
        struktur: "Kort & visuell + emoji + hashtags",
        maxLangd: "100-150 ord",
        exempelMall: `
✨ EMOJI + kort hook

1-2 korta stycken med radbrytningar för läsbarhet.

Var visuell och inspirerande!

#Hashtag #Hashtag #Hashtag
(8-12 hashtags för Instagram)`,
        exempelText: `
✨ Digital framtid börjar nu! 

Vi har just lanserat en ny tjänst som gör ditt liv lite enklare 💚

Besök oss på karlskoga.se och upptäck hur du kan sköta dina ärenden när det passar dig 🌟

📱 Enkelt
⚡ Snabbt  
💙 Tillgängligt

#Karlskoga #DigitalKommun #Framtid #Innovation #MedborgarService #Sverige #Örebro #SmartKommun`
      },

      pressmeddelande: {
        beskrivning: "Pressmeddelande för media",
        struktur: "Formell + nyhetsformat + citat + kontaktinfo",
        maxLangd: "300-500 ord",
        exempelMall: `
RUBRIK: Tydlig nyhetsrubrik

UNDERRUBRIK: Kompletterande information

DATUM, ORT - INGRESS: Sammanfatta nyheten i 2-3 meningar.

BRÖDTEXT:
Första stycket: Vad händer?
Andra stycket: Varför är det viktigt? + citat från beslutsfattare
Tredje stycket: Konkreta detaljer och fakta
Fjärde stycket: Framtida planer

CITAT: 
"[Meningsfull kommentar från ansvarig]", säger [Namn, titel].

FÖR MER INFORMATION:
Kontaktperson
Telefon
E-post`,
        exempelText: `
Karlskoga kommun lanserar ny digital plattform för medborgarservice

Investering på 2 miljoner ska förenkla kontakten mellan kommun och medborgare

KARLSKOGA, 7 januari 2025 - Karlskoga kommun lanserar idag en helt ny digital plattform som ska göra det enklare för medborgare att nå kommunens tjänster. Satsningen är en del av kommunens digitaliseringsstrategi.

Den nya plattformen innebär att medborgare kan sköta sina ärenden dygnet runt, utan köer eller väntetider. "Detta är ett viktigt steg för att vara en välkomnande och innovativ kommun", säger Eva Andersson, digitaliseringschef.

Plattformen har utvecklats i samarbete med medborgare och medarbetare under det senaste året. Första fasen omfattar de vanligaste tjänsterna, med planerad utbyggnad under våren 2025.

FÖR MER INFORMATION:
Eva Andersson, Digitaliseringschef
Tel: 0586-xxx xx
E-post: eva.andersson@karlskoga.se`
      }
    };

    // ============================================================================
    // SLUT PÅ EXEMPEL-MALLAR
    // ============================================================================

    const systemPrompt = `Du är en expert på kommunikation och PR i svensk kommunal verksamhet, med särskild kunskap om Karlskoga kommun vars vision är "Välkomnande, kloka och innovativa Karlskoga".

Din uppgift är att skapa professionella, engagerande texter för olika kommunikationskanaler baserat på användarens input.

VIKTIGT:
- Anpassa språk och ton efter målgrupp och vald kanal
- Följ de strukturer och mallar som finns för varje kanal
- Var konkret och använd aktivt språk
- Integrera Karlskogas vision när det är relevant
- Håll dig inom angivna teckengränser för varje kanal
- För sociala medier: föreslå relevanta hashtags
- För pressmeddelanden: använd formellt nyhetsformat

MALLAR OCH RIKTLINJER FÖR VARJE KANAL:
${Object.entries(CHANNEL_TEMPLATES).map(([kanal, template]) => `
${kanal.toUpperCase()}:
${template.beskrivning}
Struktur: ${template.struktur}
Max längd: ${template.maxLangd}

Exempel:
${template.exempelText}
`).join('\n---\n')}

Svara i JSON-format där varje kanal har:
{
  "channels": {
    "nyhet": {
      "rubrik": "Rubrik här",
      "text": "Fullständig text här",
      "charCount": antal_tecken
    },
    "epost": {
      "rubrik": "Ämnesrad här",
      "text": "Fullständig eposttext här",
      "charCount": antal_tecken
    },
    "facebook": {
      "text": "Inläggstext här",
      "charCount": antal_tecken,
      "hashtags": ["#hashtag1", "#hashtag2"]
    }
    // ... etc för varje vald kanal
  },
  "tips": ["Array av 4-6 praktiska tips för kommunikationen"]
}`;

    const malgruppText = malgrupper.join(', ');
    const tonText = toner.join(', ');
    const kanalerText = kanaler.join(', ');

    const userPrompt = `Skapa kommunikationsmaterial för:

BUDSKAP: ${budskap}

VARFÖR VIKTIGT: ${varfor}

MÅLGRUPPER: ${malgruppText}
TON & STIL: ${tonText}

${bakgrund ? `BAKGRUND:\n${bakgrund}\n` : ''}
${nyckelord ? `NYCKELORD ATT INKLUDERA: ${nyckelord}\n` : ''}
${tidpunkt ? `PUBLICERING: ${tidpunkt}\n` : ''}

KANALER ATT GENERERA TEXTER FÖR: ${kanalerText}

Skapa professionella, engagerande texter för varje vald kanal. Följ mallarna och riktlinjerna för respektive kanal.`;

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
            max_tokens: 2500,
            temperature: 0.8  // Något högre för mer kreativitet i texter
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
        channels: {},
        tips: ["AI-svar kunde inte parsas korrekt. Försök igen."]
      };
    }
    
    res.status(200).json(aiResponse);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Något gick fel vid genereringen',
      details: error.message
    });
  }
}
