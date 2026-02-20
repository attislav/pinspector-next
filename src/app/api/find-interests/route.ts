import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchGoogle } from '@/lib/search';
import { isValidPinterestIdeasUrl } from '@/lib/pinterest-scraper';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 45;

interface FoundInterest {
  url: string;
  title: string;
  breadcrumb: string | null;
}

async function findPinterestUrls(searchQuery: string, limit: number = 20, language?: string): Promise<FoundInterest[]> {
  const langConfig = getLanguageConfig(language);
  const found: FoundInterest[] = [];
  const seenUrls = new Set<string>();

  const collectResults = (results: { url: string; title: string; breadcrumb: string | null }[]) => {
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
  };

  // 1. Search with locale-specific site filter (e.g. site:de.pinterest.com/ideas)
  const narrowQuery = `${langConfig.siteFilter} ${searchQuery}`;
  const narrowResults = await searchGoogle(narrowQuery, limit * 3, {
    locationCode: langConfig.locationCode,
    languageCode: langConfig.languageCode,
  });
  collectResults(narrowResults);

  // 2. If we found fewer than desired, do a broader search (site:pinterest.com/ideas)
  if (found.length < limit) {
    const broadQuery = `${langConfig.siteFilterBroad} ${searchQuery}`;
    const broadResults = await searchGoogle(broadQuery, limit * 3, {
      locationCode: langConfig.locationCode,
      languageCode: langConfig.languageCode,
    });
    collectResults(broadResults);
  }

  return found;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, limit = 20, includeExisting = false, language } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword ist erforderlich' },
        { status: 400 }
      );
    }

    // Search for Pinterest Ideas URLs
    let found: FoundInterest[] = [];
    try {
      found = await findPinterestUrls(keyword, limit, language);
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

    // When includeExisting is true, return ALL URLs with an existing flag
    // (used by Discover page to also process already-known URLs)
    if (includeExisting) {
      const urlsWithStatus = found.map(f => ({
        ...f,
        existing: existingUrls.has(f.url),
      }));
      return NextResponse.json({
        urls: urlsWithStatus,
        total: found.length,
        duplicates: [],
        message: `${found.length} URLs gefunden (${duplicates.length} bereits in DB)`,
      });
    }

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
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: `Suchfehler: ${message}` },
      { status: 500 }
    );
  }
}
