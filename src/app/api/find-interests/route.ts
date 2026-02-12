import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'google-search74.p.rapidapi.com';

async function searchGoogleRapid(searchQuery: string, limit: number = 20): Promise<string[]> {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY nicht konfiguriert');
  }

  const fullQuery = `site:de.pinterest.com/ideas ${searchQuery}`;

  const response = await fetch(
    `https://${RAPIDAPI_HOST}/?query=${encodeURIComponent(fullQuery)}&limit=${limit}&related_keywords=false`,
    {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Search API Fehler: ${response.status}`);
  }

  const data = await response.json();

  // Extract Pinterest Ideas URLs from results
  const urls: string[] = [];
  const results = data.results || [];

  for (const result of results) {
    const url = result.url || result.link || '';
    if (url && url.includes('/ideas/')) {
      // Keep URL as-is if it's valid
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, limit = 20 } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword ist erforderlich' },
        { status: 400 }
      );
    }

    // Search for Pinterest Ideas URLs
    let urls: string[] = [];
    try {
      urls = await searchGoogleRapid(keyword, limit);
    } catch (searchError) {
      console.error('Search error:', searchError);
      return NextResponse.json(
        { error: searchError instanceof Error ? searchError.message : 'Suchfehler' },
        { status: 500 }
      );
    }

    if (urls.length === 0) {
      return NextResponse.json({
        urls: [],
        total: 0,
        duplicates: [],
        message: 'Keine Pinterest Ideas URLs gefunden',
      });
    }

    // Check for existing URLs in database
    const placeholders = urls.map((_, i) => `$${i + 1}`).join(', ');
    const existingIdeas = await query<{ url: string | null }>(
      `SELECT url FROM public.ideas WHERE url IN (${placeholders})`,
      urls
    );

    const existingUrls = new Set(existingIdeas.map(i => i.url));
    const duplicates = urls.filter(url => existingUrls.has(url));
    const newUrls = urls.filter(url => !existingUrls.has(url));

    return NextResponse.json({
      urls: newUrls,
      total: urls.length,
      duplicates,
      message: newUrls.length > 0
        ? `${newUrls.length} neue URLs gefunden`
        : 'Alle gefundenen URLs sind bereits in der Datenbank',
    });
  } catch (error) {
    console.error('Find interests error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
