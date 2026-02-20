import { NextRequest, NextResponse } from 'next/server';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { getLanguageConfig, detectLanguageFromUrl } from '@/lib/language-config';

export const maxDuration = 30;

/**
 * POST /api/scrape-live
 *
 * Always scrapes fresh from Pinterest. No database reads or writes.
 * Designed for external API consumers who want live data.
 *
 * Body: { url: string, language?: 'de'|'en'|'fr'|'es'|'it'|'pt'|'nl' }
 */
export async function POST(request: NextRequest) {
  try {
    const { url, language } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const detectedLang = detectLanguageFromUrl(url);
    const langConfig = getLanguageConfig(language || detectedLang || undefined);

    const scrapeResult = await scrapePinterestIdea(url, {
      acceptLanguage: langConfig.acceptLanguage,
      pinterestDomain: langConfig.pinterestDomain,
    });

    if (!scrapeResult.success || !scrapeResult.idea) {
      return NextResponse.json(scrapeResult, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      idea: scrapeResult.idea,
      pins: scrapeResult.pins || [],
      language: langConfig.languageCode,
    });
  } catch (error) {
    console.error('Scrape-live API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
