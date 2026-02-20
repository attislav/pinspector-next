import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { scrapePinterestIdea, extractIdFromUrl } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 30;

interface DbIdea {
  id: string;
  searches: number;
  last_update: Date | null;
  last_scrape: Date | null;
}

export async function POST(request: NextRequest) {
  try {
    const { url, skipIfRecent, language } = await request.json();
    const langConfig = getLanguageConfig(language);

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL ist erforderlich' },
        { status: 400 }
      );
    }

    // If skipIfRecent is true, first check if we already have this idea with recent scrape
    if (skipIfRecent) {
      const idFromUrl = extractIdFromUrl(url);
      if (idFromUrl) {
        const existingIdea = await queryOne<DbIdea>(
          'SELECT * FROM public.ideas WHERE id = $1',
          [idFromUrl]
        );

        if (existingIdea) {
          // Check if scraped within the last hour
          const lastScrape = existingIdea.last_scrape ? new Date(existingIdea.last_scrape) : new Date(0);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

          if (lastScrape > oneHourAgo) {
            return NextResponse.json({
              success: true,
              idea: existingIdea,
              isNew: false,
              isDuplicate: true,
              skippedScrape: true,
            });
          }
        }
      }
    }

    // Scrape the Pinterest page
    const scrapeResult = await scrapePinterestIdea(url, {
      acceptLanguage: langConfig.acceptLanguage,
    });

    if (!scrapeResult.success || !scrapeResult.idea) {
      return NextResponse.json(scrapeResult, { status: 400 });
    }

    const idea = scrapeResult.idea;
    const pins = scrapeResult.pins || [];

    // Save idea to database
    const { isNew, isDuplicate } = await saveIdeaToDb(idea);

    // Save pins to database
    await savePinsToDb(idea.id, pins);

    return NextResponse.json({
      success: true,
      idea,
      pins,
      isNew,
      isDuplicate,
    });
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
