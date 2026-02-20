import { NextRequest, NextResponse } from 'next/server';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { getLanguageConfig, detectLanguageFromUrl } from '@/lib/language-config';

export const maxDuration = 30;

/**
 * POST /api/find-or-scrape-live
 *
 * Finds a Pinterest Ideas page by name or URL and scrapes it fresh.
 * No database reads or writes — always scrapes directly from Pinterest.
 *
 * Body: { name?: string, url?: string, language?: 'de'|'en'|'fr'|'es'|'it'|'pt'|'nl' }
 */
export async function POST(request: NextRequest) {
  try {
    const { name, url, language } = await request.json();
    const detectedLang = url ? detectLanguageFromUrl(url) : null;
    const langConfig = getLanguageConfig(language || detectedLang || undefined);

    if (!name && !url) {
      return NextResponse.json(
        { success: false, error: 'Name or URL is required' },
        { status: 400 }
      );
    }

    // If URL is provided, scrape directly
    if (url) {
      const scrapeResult = await scrapePinterestIdea(url, {
        acceptLanguage: langConfig.acceptLanguage,
        pinterestDomain: langConfig.pinterestDomain,
        language: langConfig.languageCode,
      });

      if (scrapeResult.success && scrapeResult.idea) {
        return NextResponse.json({
          success: true,
          idea: scrapeResult.idea,
          pins: scrapeResult.pins || [],
          source: 'scraped',
          language: langConfig.languageCode,
        });
      }

      return NextResponse.json(
        { success: false, error: scrapeResult.error || 'Scraping failed' },
        { status: 400 }
      );
    }

    // Try to construct Pinterest Ideas URL from name and scrape
    const slug = name!.toLowerCase()
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const urlsToTry = [
      `https://${langConfig.pinterestFallbackDomain}/ideas/${slug}/`,
      `https://www.pinterest.com/ideas/${slug}/`,
    ];

    for (const tryUrl of urlsToTry) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': langConfig.acceptLanguage,
          },
          redirect: 'follow',
        });

        const finalUrl = response.url;

        if (finalUrl.match(/\/ideas\/[^/]+\/\d+/)) {
          const scrapeResult = await scrapePinterestIdea(finalUrl, {
            acceptLanguage: langConfig.acceptLanguage,
            pinterestDomain: langConfig.pinterestDomain,
            language: langConfig.languageCode,
          });

          if (scrapeResult.success && scrapeResult.idea) {
            return NextResponse.json({
              success: true,
              idea: scrapeResult.idea,
              pins: scrapeResult.pins || [],
              source: 'scraped_redirect',
              language: langConfig.languageCode,
            });
          }
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({
      success: false,
      error: `Interest "${name}" not found`,
    });
  } catch (error) {
    console.error('Find-or-scrape-live error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
