import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { keyword, titles } = await request.json();

    if (!keyword || !titles || !Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json(
        { error: 'Keyword und Titel sind erforderlich' },
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

    const prompt = `Analysiere diese Pinterest Pin-Titel für "${keyword}" und sag mir, welchen Content ich erstellen muss um in die Top 10 zu kommen.

Pin-Titel:
${validTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}

Antworte NUR in diesem Format:

DOMINANTER CONTENT-TYP:
[z.B. Listenartikel, Einzelartikel, Infografik, Produktvergleich, Inspiration, DIY-Anleitung, Rezept, Tutorial]

WAS RANKT:
- [Bullet 1]
- [Bullet 2]
- [Bullet 3]

MEINE EMPFEHLUNG:
[1-2 Sätze: Was genau du erstellen solltest, um zu ranken]

Sei konkret und kurz. Keine Einleitung, keine Erklärungen.`;

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
        max_tokens: 500,
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
    const analysis = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Analyze content error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
