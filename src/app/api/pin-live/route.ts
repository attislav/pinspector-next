import { NextRequest, NextResponse } from 'next/server';
import { scrapePinterestPin, extractPinIdFromUrl, isValidPinterestPinUrl } from '@/lib/pinterest-scraper';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 30;

/**
 * POST /api/pin-live
 *
 * Scrapes a single Pinterest pin page live and returns all available data
 * including annotations, board info, pinner info, engagement metrics, etc.
 * No database reads or writes.
 *
 * Body: { pinId?: string, url?: string, language?: 'de'|'en'|'fr'|'es'|'it'|'pt'|'nl' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pinId: rawPinId, url, language } = body;

    // Resolve pin ID from either pinId or url parameter
    let pinId = rawPinId;
    if (!pinId && url) {
      if (!isValidPinterestPinUrl(url)) {
        return NextResponse.json(
          { success: false, error: 'Ungueltige Pinterest-Pin-URL. Erwartet: https://www.pinterest.com/pin/{id}/' },
          { status: 400 }
        );
      }
      pinId = extractPinIdFromUrl(url);
    }

    if (!pinId) {
      return NextResponse.json(
        { success: false, error: 'pinId oder url ist erforderlich' },
        { status: 400 }
      );
    }

    // Validate pinId is numeric
    if (!/^\d+$/.test(pinId)) {
      return NextResponse.json(
        { success: false, error: 'pinId muss numerisch sein' },
        { status: 400 }
      );
    }

    const langConfig = getLanguageConfig(language || undefined);

    const result = await scrapePinterestPin(pinId, {
      acceptLanguage: langConfig.acceptLanguage,
      pinterestDomain: langConfig.pinterestDomain,
      language: langConfig.languageCode,
    });

    if (!result.success || !result.pin) {
      return NextResponse.json(
        { success: false, error: result.error || 'Pin-Scraping fehlgeschlagen' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pin: result.pin,
      language: langConfig.languageCode,
    });
  } catch (error) {
    console.error('Pin-live API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
