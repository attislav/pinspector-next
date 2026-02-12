import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

interface InputIdea {
  name: string;
  searches: number;
}

interface InputKeyword {
  name: string;
  count: number;
  source: string;
}

export async function POST(request: NextRequest) {
  try {
    const { topic, ideas, keywords } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: 'Thema ist erforderlich' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API Key nicht konfiguriert' }, { status: 500 });
    }

    // Build context from collected data
    const ideaLines = (ideas as InputIdea[])
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 40)
      .map(i => `- ${i.name} (${i.searches} Suchen)`)
      .join('\n');

    const keywordLines = (keywords as InputKeyword[])
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map(k => `- ${k.name} (${k.count}x, ${k.source})`)
      .join('\n');

    const prompt = `Du bist ein Pinterest-SEO-Experte. Analysiere diese Daten zum Thema "${topic}" und erstelle eine strukturierte Topical Map.

GEFUNDENE PINTEREST IDEAS (mit Suchvolumen):
${ideaLines || '(keine)'}

GESAMMELTE KEYWORDS (aus Annotations, KLP Pivots, Related Interests):
${keywordLines || '(keine)'}

Erstelle eine Topical Map mit 4-7 thematischen Säulen (Pillars). Antworte EXAKT in diesem JSON-Format:

{
  "summary": "1-2 Sätze: Überblick über das Thema und wo der größte Fokus liegen sollte",
  "pillars": [
    {
      "name": "Pillar-Name",
      "description": "Kurze Beschreibung was dieser Pillar abdeckt",
      "priority": "high|medium|low",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "topRecommendation": "2-3 Sätze: Konkrete Empfehlung auf welche Pillars und Keywords man sich fokussieren sollte und warum"
}

Regeln:
- Sortiere Pillars nach Wichtigkeit (high zuerst)
- Keywords innerhalb eines Pillars nach Relevanz sortieren
- Jeder Pillar sollte 3-8 Keywords haben
- Keywords sollen aus den gesammelten Daten kommen, nicht erfunden
- Wenn ein Keyword in mehreren Pillars passt, weise es dem wichtigsten zu
- Priority "high" = hohes Suchvolumen + viele Keywords, "medium" = mittel, "low" = Nische
- Deutsche Begriffe
- NUR valides JSON zurückgeben, kein Markdown, keine Erklärungen`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: 'OpenAI API Fehler: ' + (error.error?.message || 'Unbekannt') },
        { status: 500 }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    // Strip markdown code fences if present
    content = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    let topicalMap;
    try {
      topicalMap = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'KI-Antwort konnte nicht als JSON geparst werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      topicalMap,
    });
  } catch (error) {
    console.error('Cluster keywords error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
