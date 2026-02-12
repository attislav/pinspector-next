import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchGoogle } from '@/lib/search';
import { isValidPinterestIdeasUrl } from '@/lib/pinterest-scraper';

export const maxDuration = 30;

async function findPinterestUrls(searchQuery: string, limit: number = 20): Promise<string[]> {
  const fullQuery = `site:de.pinterest.com/ideas ${searchQuery}`;
  const results = await searchGoogle(fullQuery, limit * 2);

  const urls: string[] = [];
  for (const result of results) {
    const url = result.url;
    if (url && url.includes('/ideas/') && isValidPinterestIdeasUrl(url) && !urls.includes(url)) {
      urls.push(url);
    }
    if (urls.length >= limit) break;
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
      urls = await findPinterestUrls(keyword, limit);
    } catch (searchError) {
      console.error('Search error:', searchError);
      const message = searchError instanceof Error ? searchError.message : 'Suchfehler';
      if (message.includes('Rate-Limit') || message.includes('429')) {
        return NextResponse.json(
          { error: message },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: message },
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
