import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchGoogle, SearchResult } from '@/lib/search';
import { isValidPinterestIdeasUrl } from '@/lib/pinterest-scraper';

export const maxDuration = 30;

interface FoundInterest {
  url: string;
  title: string;
  breadcrumb: string | null;
}

async function findPinterestUrls(searchQuery: string, limit: number = 20): Promise<FoundInterest[]> {
  const fullQuery = `site:de.pinterest.com/ideas ${searchQuery}`;
  const results = await searchGoogle(fullQuery, limit * 2);

  const found: FoundInterest[] = [];
  const seenUrls = new Set<string>();

  for (const result of results) {
    const url = result.url;
    if (url && url.includes('/ideas/') && isValidPinterestIdeasUrl(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      found.push({
        url,
        title: result.title,
        breadcrumb: result.breadcrumb,
      });
    }
    if (found.length >= limit) break;
  }

  return found;
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
    let found: FoundInterest[] = [];
    try {
      found = await findPinterestUrls(keyword, limit);
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

    if (found.length === 0) {
      return NextResponse.json({
        urls: [],
        total: 0,
        duplicates: [],
        message: 'Keine Pinterest Ideas URLs gefunden',
      });
    }

    // Check for existing URLs in database
    const allUrls = found.map(f => f.url);
    const placeholders = allUrls.map((_, i) => `$${i + 1}`).join(', ');
    const existingIdeas = await query<{ url: string | null }>(
      `SELECT url FROM public.ideas WHERE url IN (${placeholders})`,
      allUrls
    );

    const existingUrls = new Set(existingIdeas.map(i => i.url));
    const duplicates = allUrls.filter(url => existingUrls.has(url));
    const newItems = found.filter(f => !existingUrls.has(f.url));

    return NextResponse.json({
      urls: newItems,
      total: found.length,
      duplicates,
      message: newItems.length > 0
        ? `${newItems.length} neue URLs gefunden`
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
