import { NextRequest, NextResponse } from 'next/server';
import { searchGoogle } from '@/lib/search';
import { isValidPinterestIdeasUrl } from '@/lib/pinterest-scraper';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 45;

interface FoundInterest {
  url: string;
  title: string;
  breadcrumb: string | null;
}

/**
 * POST /api/find-interests-live
 *
 * Searches Google for Pinterest Ideas URLs. No database reads or writes.
 * Returns all found URLs without any duplicate checking against DB.
 *
 * Body: { keyword: string, limit?: number, language?: 'de'|'en'|'fr'|'es'|'it'|'pt'|'nl' }
 */
export async function POST(request: NextRequest) {
  try {
    const { keyword, limit = 20, language } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { success: false, error: 'Keyword is required' },
        { status: 400 }
      );
    }

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

    try {
      // 1. Search with locale-specific site filter
      const narrowQuery = `${langConfig.siteFilter} ${keyword}`;
      const narrowResults = await searchGoogle(narrowQuery, limit * 3, {
        locationCode: langConfig.locationCode,
        languageCode: langConfig.languageCode,
      });
      collectResults(narrowResults);

      // 2. Fallback: broader search if not enough results
      if (found.length < limit) {
        const broadQuery = `${langConfig.siteFilterBroad} ${keyword}`;
        const broadResults = await searchGoogle(broadQuery, limit * 3, {
          locationCode: langConfig.locationCode,
          languageCode: langConfig.languageCode,
        });
        collectResults(broadResults);
      }
    } catch (searchError) {
      console.error('Search error:', searchError);
      const message = searchError instanceof Error ? searchError.message : 'Search error';
      const status = message.includes('Rate-Limit') || message.includes('429') ? 429 : 500;
      return NextResponse.json(
        { success: false, error: message },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      urls: found,
      total: found.length,
      language: langConfig.languageCode,
    });
  } catch (error) {
    console.error('Find-interests-live error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Search error: ${message}` },
      { status: 500 }
    );
  }
}
