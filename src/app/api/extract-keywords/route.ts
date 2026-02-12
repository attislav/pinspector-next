import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { titles } = await request.json();

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json(
        { error: 'Titel sind erforderlich' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API Key nicht konfiguriert' },
        { status: 500 }
      );
    }

    // Filter out empty titles
    const validTitles = titles.filter((t: string) => t && t.trim().length > 0);

    if (validTitles.length === 0) {
      return NextResponse.json(
        { error: 'Keine gültigen Titel gefunden' },
        { status: 400 }
      );
    }

    const prompt = `Gib nur die Keywords aus, sonst nichts.

Ein Keyword pro Zeile.

Das Keyword muss:
- spezifisch sein (keine vagen Kategorien)
- konkret sein (muss genau beschreiben, worum es im Titel geht)
- als eigenständiges Thema verwendbar sein

Entferne:
- generische Container wie "Ideen", "Sammlung", "Rezepte", "Guide", "10 Tipps", etc.
- Duplikate
- unnötige Füllwörter

Behalte bedeutungsvolle Attribute, die das Thema definieren:
- Zutat(en), Saison, Stil, Farbe, Material
- "vegan", "low carb", "DIY", "im Glas", "ohne Backen"
- jedes Merkmal, das das Thema konkret und unterscheidbar macht

Wenn der Titel vage ist, leite das wahrscheinlichste spezifische Keyword ab.

Füge KEINE neuen Themen hinzu.
Gib KEINE Erklärungen zurück.

Pin-Titel:
${validTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}`;

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
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'OpenAI API Fehler: ' + (error.error?.message || 'Unbekannt') },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse keywords from response
    const keywords = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith('-'))
      .map((line: string) => line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter((kw: string) => kw.length > 0);

    // Remove duplicates (case-insensitive)
    const uniqueKeywords = [...new Set(keywords.map((k: string) => k.toLowerCase()))]
      .map(k => keywords.find((kw: string) => kw.toLowerCase() === k) || k);

    return NextResponse.json({
      success: true,
      keywords: uniqueKeywords,
      count: uniqueKeywords.length,
    });
  } catch (error) {
    console.error('Extract keywords error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
