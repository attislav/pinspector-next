import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

interface PinImage {
  position: number;
  imageUrl: string;
  title: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, pins } = await request.json() as { keyword: string; pins: PinImage[] };

    if (!keyword || !pins || !Array.isArray(pins) || pins.length === 0) {
      return NextResponse.json({ error: 'Keyword und Pins sind erforderlich' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API Key nicht konfiguriert' }, { status: 500 });
    }

    // Limit to top 10 pins with images
    const validPins = pins.filter(p => p.imageUrl).slice(0, 10);
    if (validPins.length === 0) {
      return NextResponse.json({ error: 'Keine Pins mit Bildern gefunden' }, { status: 400 });
    }

    const imageContent = validPins.map((pin) => ([
      {
        type: 'text' as const,
        text: `Pin #${pin.position}${pin.title ? ` (Titel: "${pin.title}")` : ''}:`,
      },
      {
        type: 'image_url' as const,
        image_url: { url: pin.imageUrl, detail: 'low' as const },
      },
    ])).flat();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `Du bist ein Pinterest-Bildanalyst. Deine Aufgabe ist es, für jedes Bild zu beschreiben, was darauf zu sehen ist – im Kontext des Keywords "${keyword}".

REGELN:
- Fokussiere dich NUR auf das Hauptthema des Keywords. Bei "${keyword}" ist das Wichtigste: Was genau zeigt das Bild im Bezug auf das Keyword?
- Beschreibe in MAX 5-8 Wörtern pro Bild
- Die Beschreibung muss als H2/H3 Heading in einem Blogartikel funktionieren
- Keine ganzen Sätze, nur Heading-Stil (z.B. "Weißes Leinenkleid mit Strohhut", "Minimalistischer Holztisch mit Kerzen")
- Sei spezifisch: Farben, Materialien, Stil, Details nennen
- ÜBERSPRINGE Bilder die keinen visuellen Mehrwert haben: reine Textbilder, Infografiken, Collagen mit überwiegend Text, Screenshots, Listenbilder. Für solche Pins setze heading auf null.
- Antworte NUR im JSON-Format`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analysiere diese ${validPins.length} Top-Pins für "${keyword}". Antworte als JSON-Array:
[{"position": 1, "heading": "Kurze Heading-Beschreibung"}, ...]
Setze heading auf null für Textbilder/Infografiken/Screenshots ohne echten visuellen Content.`,
              },
              ...imageContent,
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI Vision API error:', error);
      return NextResponse.json(
        { error: 'OpenAI API Fehler: ' + (error.error?.message || 'Unbekannt') },
        { status: 500 },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    let results: { position: number; heading: string }[];
    try {
      const parsed = JSON.parse(content);
      const raw: { position: number; heading: string | null }[] = Array.isArray(parsed) ? parsed : parsed.results || parsed.pins || parsed.headings || [];
      results = raw.filter((r): r is { position: number; heading: string } => r.heading != null && r.heading.trim() !== '');
    } catch {
      console.error('Failed to parse vision response:', content);
      return NextResponse.json({ error: 'Fehler beim Parsen der Antwort' }, { status: 500 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Analyze pin images error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
