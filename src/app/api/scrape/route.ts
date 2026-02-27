import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { scrapePinterestIdea, extractIdFromUrl, isValidPinterestIdeasUrl } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';
import { getLanguageConfig, detectLanguageFromUrl } from '@/lib/language-config';

export const maxDuration = 30;

// Resolve a Pinterest Ideas URL that may not have a numeric ID
// by following redirects to find the canonical URL with ID
async function resolveAnnotationUrl(url: string, langConfig: ReturnType<typeof getLanguageConfig>): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': langConfig.acceptLanguage,
      },
      redirect: 'follow',
    });
    const finalUrl = response.url;
    if (finalUrl && /\/ideas\/[^/]+\/\d+/.test(finalUrl)) {
      return finalUrl;
    }
  } catch {
    // ignore fetch errors
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    let { url, skipIfRecent, language } = await request.json();
    const detectedLang = detectLanguageFromUrl(url);
    const langConfig = getLanguageConfig(language || detectedLang || undefined);

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL ist erforderlich' },
        { status: 400 }
      );
    }

    // If URL doesn't have a numeric ID (e.g. /ideas/keyword/ without /123456/),
    // try to resolve it by following redirects
    if (!isValidPinterestIdeasUrl(url) && url.includes('/ideas/')) {
      const resolvedUrl = await resolveAnnotationUrl(url, langConfig);
      if (resolvedUrl) {
        url = resolvedUrl;
      } else {
        return NextResponse.json(
          { success: false, error: 'Annotation-URL konnte nicht aufgelöst werden' },
          { status: 400 }
        );
      }
    }

    // If skipIfRecent is true, first check if we already have this idea with recent scrape
    if (skipIfRecent) {
      const idFromUrl = extractIdFromUrl(url);
      if (idFromUrl) {
        const supabase = getSupabase();
        const { data: existingIdea } = await supabase
          .from('ideas')
          .select('*')
          .eq('id', idFromUrl)
          .single();

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
      pinterestDomain: langConfig.pinterestDomain,
      language: langConfig.languageCode,
    });

    if (!scrapeResult.success || !scrapeResult.idea) {
      return NextResponse.json(scrapeResult, { status: 400 });
    }

    const idea = scrapeResult.idea;
    const pins = scrapeResult.pins || [];

    // Save idea to database
    let isNew = false;
    let isDuplicate = false;
    try {
      const saveResult = await saveIdeaToDb(idea);
      isNew = saveResult.isNew;
      isDuplicate = saveResult.isDuplicate;
    } catch (dbError) {
      console.error('Database error saving idea:', dbError);
      // Return the scraped data even if DB save fails
      return NextResponse.json({
        success: true,
        idea,
        pins,
        isNew: false,
        isDuplicate: false,
        dbError: 'Idee konnte nicht in der Datenbank gespeichert werden',
      });
    }

    // Save pins to database (non-critical)
    try {
      await savePinsToDb(idea.id, pins);
    } catch (dbError) {
      console.error('Database error saving pins:', dbError);
    }

    return NextResponse.json({
      success: true,
      idea,
      pins,
      isNew,
      isDuplicate,
    });
  } catch (error) {
    console.error('Scrape API error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { success: false, error: `Scrape-Fehler: ${message}` },
      { status: 500 }
    );
  }
}
