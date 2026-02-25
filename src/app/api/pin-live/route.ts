import { NextRequest, NextResponse } from 'next/server';
import { scrapePinterestPin, extractPinIdFromUrl, isValidPinterestPinUrl } from '@/lib/pinterest-scraper';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 30;

function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

async function handlePinLive(pinId: string, language?: string) {
  if (!/^\d+$/.test(pinId)) {
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'pinId muss numerisch sein' },
      { status: 400 }
    ));
  }

  const langConfig = getLanguageConfig(language || undefined);

  const result = await scrapePinterestPin(pinId, {
    acceptLanguage: langConfig.acceptLanguage,
    pinterestDomain: langConfig.pinterestDomain,
    language: langConfig.languageCode,
  });

  if (!result.success || !result.pin) {
    return addCorsHeaders(NextResponse.json(
      { success: false, error: result.error || 'Pin-Scraping fehlgeschlagen' },
      { status: 422 }
    ));
  }

  return addCorsHeaders(NextResponse.json({
    success: true,
    pin: result.pin,
    language: langConfig.languageCode,
  }));
}

/**
 * GET /api/pin-live?pinId=123&language=de
 * GET /api/pin-live?url=https://pinterest.com/pin/123/&language=de
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let pinId = searchParams.get('pinId') || '';
    const url = searchParams.get('url') || '';
    const language = searchParams.get('language') || undefined;

    if (!pinId && url) {
      if (!isValidPinterestPinUrl(url)) {
        return addCorsHeaders(NextResponse.json(
          { success: false, error: 'Ungueltige Pinterest-Pin-URL' },
          { status: 400 }
        ));
      }
      pinId = extractPinIdFromUrl(url) || '';
    }

    if (!pinId) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'pinId oder url Parameter erforderlich' },
        { status: 400 }
      ));
    }

    return handlePinLive(pinId, language);
  } catch (error) {
    console.error('Pin-live GET error:', error);
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ));
  }
}

/**
 * POST /api/pin-live
 * Body: { pinId?: string, url?: string, language?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pinId: rawPinId, url, language } = body;

    let pinId = rawPinId;
    if (!pinId && url) {
      if (!isValidPinterestPinUrl(url)) {
        return addCorsHeaders(NextResponse.json(
          { success: false, error: 'Ungueltige Pinterest-Pin-URL' },
          { status: 400 }
        ));
      }
      pinId = extractPinIdFromUrl(url);
    }

    if (!pinId) {
      return addCorsHeaders(NextResponse.json(
        { success: false, error: 'pinId oder url ist erforderlich' },
        { status: 400 }
      ));
    }

    return handlePinLive(pinId, language);
  } catch (error) {
    console.error('Pin-live POST error:', error);
    return addCorsHeaders(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ));
  }
}

export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 204 }));
}
