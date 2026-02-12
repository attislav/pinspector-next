import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

async function generateSubTopics(topic: string): Promise<string[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OpenAI API Key nicht konfiguriert');
  }

  const prompt = `Du bist ein Pinterest-Keyword-Experte. Zu dem Thema "${topic}" brauchst du eine umfassende Topical Map.

Generiere 10-15 Suchbegriffe, die ich auf Pinterest als "Ideas" finden würde. Denke dabei an:

1. Hauptvarianten des Themas (mit verschiedenen Attributen wie Stil, Material, Farbe, Saison)
2. Unterbereiche die nicht direkt im Wort stecken, aber thematisch wichtig sind
3. Verwandte Themen die jemand suchen würde, der sich für "${topic}" interessiert
4. Spezifische Ausprägungen (z.B. "DIY", "modern", "minimalistisch", "günstig")
5. Saisonale oder trendige Varianten

Regeln:
- Nur deutsche Begriffe
- Jeder Begriff auf einer eigenen Zeile
- Keine Nummerierung, keine Erklärungen
- Begriffe sollten so sein, wie Leute auf Pinterest suchen würden
- Mix aus breiten und spezifischen Begriffen`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error('OpenAI API Fehler: ' + (error.error?.message || 'Unbekannt'));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return content
    .split('\n')
    .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim())
    .filter((line: string) => line.length > 2 && line.length < 80);
}

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Thema ist erforderlich' },
        { status: 400 }
      );
    }

    const subTopics = await generateSubTopics(topic);

    return NextResponse.json({
      success: true,
      topic,
      subTopics,
    });
  } catch (error) {
    console.error('Discover topics error:', error);
    const message = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
