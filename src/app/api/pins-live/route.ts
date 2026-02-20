import { NextRequest, NextResponse } from 'next/server';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { getLanguageConfig, detectLanguageFromUrl } from '@/lib/language-config';

export const maxDuration = 30;

/**
 * POST /api/pins-live
 *
 * Always scrapes fresh pins from a Pinterest Ideas page. No database reads or writes.
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
      language: langConfig.languageCode,
    });

    if (!scrapeResult.success || !scrapeResult.idea) {
      return NextResponse.json(
        { success: false, error: scrapeResult.error || 'Scraping failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      idea_id: scrapeResult.idea.id,
      idea_name: scrapeResult.idea.name,
      pins: scrapeResult.pins || [],
      total: (scrapeResult.pins || []).length,
      language: langConfig.languageCode,
    });
  } catch (error) {
    console.error('Pins-live API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
