import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { keyword, language, minSaves } = await request.json() as {
      keyword: string;
      language?: string;
      minSaves?: number;
    };

    if (!keyword) {
      return NextResponse.json({ success: false, error: 'keyword ist erforderlich' }, { status: 400 });
    }

    const langConfig = getLanguageConfig(language || 'de');
    const supabase = getSupabase();
    const minSaveCount = minSaves ?? 0;

    // Step 1: Find idea in DB (exact match, then partial)
    let idea: { id: string; name: string; url: string | null } | null = null;

    const { data: exactMatch } = await supabase
      .from('ideas')
      .select('id, name, url')
      .ilike('name', keyword)
      .limit(1)
      .single();

    if (exactMatch) {
      idea = exactMatch;
    } else {
      const { data: partialMatch } = await supabase
        .from('ideas')
        .select('id, name, url')
        .ilike('name', `%${keyword}%`)
        .order('searches', { ascending: false })
        .limit(1)
        .single();

      if (partialMatch) {
        idea = partialMatch;
      }
    }

    // Step 2: If not in DB, try to scrape from Pinterest
    if (!idea) {
      const slug = keyword.toLowerCase()
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
              await saveIdeaToDb(scrapeResult.idea);
              const pins = scrapeResult.pins || [];
              if (pins.length > 0) {
                await savePinsToDb(scrapeResult.idea.id, pins);
              }
              idea = { id: scrapeResult.idea.id, name: scrapeResult.idea.name, url: scrapeResult.idea.url };
              break;
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (!idea) {
      return NextResponse.json({
        success: false,
        error: `Keyword "${keyword}" nicht gefunden — weder in DB noch auf Pinterest`,
      }, { status: 404 });
    }

    // Step 3: Fetch pins from DB
    const { data: ideaPins, error: pinsError } = await supabase
      .from('idea_pins')
      .select('position, pins(*)')
      .eq('idea_id', idea.id)
      .order('position', { ascending: true });

    if (pinsError) {
      return NextResponse.json({ success: false, error: `DB-Fehler: ${pinsError.message}` }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPins = (ideaPins || [])
      .map((ip: any) => ({ position: ip.position, ...ip.pins }))
      .filter((p: any) => typeof p.save_count === 'number');

    // Step 4: Filter by minSaves
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredPins = minSaveCount > 0
      ? allPins.filter((p: any) => p.save_count >= minSaveCount)
      : allPins;

    return NextResponse.json({
      success: true,
      idea: { id: idea.id, name: idea.name, url: idea.url },
      totalPins: allPins.length,
      filteredPins: filteredPins.length,
      minSaves: minSaveCount,
      pins: filteredPins,
    });
  } catch (error) {
    console.error('keyword-pins error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
