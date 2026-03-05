import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json() as { imageUrl: string };

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl ist erforderlich' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API Key nicht konfiguriert' }, { status: 500 });
    }

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
            content: `You are an expert at analyzing images and writing precise image generation prompts (for Midjourney, DALL-E, Flux, etc.).

YOUR TASK: Analyze the given image in detail and produce a prompt that would recreate it as closely as possible in an AI image generator.

RULES:
- Be SPECIFIC, not vague. Describe exactly what you see.
- Include: subject/main object, pose/composition, camera angle, lighting (direction, color temperature, mood), color palette (specific colors), background/setting, style (photo, illustration, flat lay, etc.), textures and materials, typography if present (font style, placement, colors), any overlays or graphic elements.
- For photography: mention lens type (wide, macro, portrait), depth of field, bokeh.
- For illustrations/graphics: mention art style, line weight, shading technique.
- Format the prompt as a single continuous paragraph, ready to paste into an image generator.
- Write the prompt in ENGLISH regardless of image content.
- Do NOT start with "Create" or "Generate" — just describe the image directly as a prompt.
- Aim for 80-150 words. Be dense with detail, not flowery.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and write a precise, specific image generation prompt that would recreate it:',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
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
    const prompt = data.choices?.[0]?.message?.content?.trim() || '';

    if (!prompt) {
      return NextResponse.json({ error: 'Keine Antwort erhalten' }, { status: 500 });
    }

    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error('Generate image prompt error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
