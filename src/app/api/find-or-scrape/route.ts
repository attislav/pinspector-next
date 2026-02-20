import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { saveIdeaToDb } from '@/lib/idea-persistence';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 30;

interface DbIdea {
  id: string;
  name: string;
  url: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { name, url, language } = await request.json();
    const langConfig = getLanguageConfig(language);

    if (!name && !url) {
      return NextResponse.json(
        { success: false, error: 'Name oder URL erforderlich' },
        { status: 400 }
      );
    }

    // If URL is provided, scrape directly
    if (url) {
      const scrapeResult = await scrapePinterestIdea(url, {
        acceptLanguage: langConfig.acceptLanguage,
      });
      if (scrapeResult.success && scrapeResult.idea) {
        return NextResponse.json({
          success: true,
          idea: scrapeResult.idea,
          source: 'scraped',
        });
      }
      return NextResponse.json({
        success: false,
        error: scrapeResult.error || 'Scraping fehlgeschlagen',
      });
    }

    // Search by name in database first (case-insensitive)
    const existingIdea = await queryOne<DbIdea>(
      `SELECT id, name, url FROM public.ideas
       WHERE LOWER(name) = LOWER($1)
       LIMIT 1`,
      [name]
    );

    if (existingIdea) {
      return NextResponse.json({
        success: true,
        idea: existingIdea,
        source: 'database',
      });
    }

    // Try partial match
    const partialMatch = await queryOne<DbIdea>(
      `SELECT id, name, url FROM public.ideas
       WHERE LOWER(name) LIKE LOWER($1)
       ORDER BY searches DESC
       LIMIT 1`,
      [`%${name}%`]
    );

    if (partialMatch) {
      return NextResponse.json({
        success: true,
        idea: partialMatch,
        source: 'database_partial',
      });
    }

    // Try to construct Pinterest Ideas URL and scrape
    const slug = name.toLowerCase()
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
          },
          redirect: 'follow',
        });

        const finalUrl = response.url;

        if (finalUrl.match(/\/ideas\/[^/]+\/\d+/)) {
          const scrapeResult = await scrapePinterestIdea(finalUrl, {
            acceptLanguage: langConfig.acceptLanguage,
          });
          if (scrapeResult.success && scrapeResult.idea) {
            await saveIdeaToDb(scrapeResult.idea);
            return NextResponse.json({
              success: true,
              idea: scrapeResult.idea,
              source: 'scraped_redirect',
            });
          }
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({
      success: false,
      error: `Interest "${name}" nicht gefunden`,
      searched: true,
    });
  } catch (error) {
    console.error('Find or scrape error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
