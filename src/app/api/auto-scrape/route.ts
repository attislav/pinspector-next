import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 60;

interface AutoScrapeCandidate {
  id: string;
  name: string;
  url: string;
  language: string;
  searches: number;
  last_scrape: string | null;
  pivot_count: number;
  related_count: number;
  score: number;
}

export async function POST(request: NextRequest) {
  // API Key auth
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.AUTO_SCRAPE_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const language: string = body.language || 'de';
    const minAgeDays: number = body.minAgeDays || 30;
    const maxAnnotations: number = Math.min(body.maxAnnotations || 20, 30);
    const scrapeRelated: boolean = body.scrapeRelated !== false;

    const supabase = getSupabase();

    // Step 1: Pick the best candidate
    const { data: candidates, error: rpcError } = await supabase.rpc('get_auto_scrape_candidate', {
      p_language: language,
      p_min_age_days: minAgeDays,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, error: `RPC error: ${rpcError.message}` }, { status: 500 });
    }

    const candidate = (candidates as AutoScrapeCandidate[] | null)?.[0];
    if (!candidate) {
      return NextResponse.json({
        success: true,
        message: 'No candidates found — all ideas are up to date',
        idea: null,
      });
    }

    // Step 2: Scrape the main idea
    const langConfig = getLanguageConfig(language);
    const scrapeResult = await scrapePinterestIdea(candidate.url, {
      acceptLanguage: langConfig.acceptLanguage,
      pinterestDomain: langConfig.pinterestDomain,
      language: langConfig.languageCode,
    });

    if (!scrapeResult.success || !scrapeResult.idea) {
      return NextResponse.json({
        success: false,
        error: `Scrape failed for ${candidate.name}: ${scrapeResult.error}`,
        candidate,
      }, { status: 500 });
    }

    const idea = scrapeResult.idea;
    const pins = scrapeResult.pins || [];

    // Save idea + pins
    const saveResult = await saveIdeaToDb(idea);
    try { await savePinsToDb(idea.id, pins); } catch { /* non-critical */ }

    // Step 3: Scrape annotations (if enabled)
    let annotationStats = { total: 0, scraped: 0, newCreated: 0, existingUpdated: 0, failed: 0, skipped: 0 };

    if (scrapeRelated) {
      // Collect all unique items from all sources, deduplicated by name
      const seen = new Set<string>();
      const withUrl: { name: string; url: string }[] = [];
      const withoutUrl: string[] = [];

      // KLP Pivots
      if (idea.klp_pivots) {
        for (const pivot of idea.klp_pivots) {
          if (pivot.url && !seen.has(pivot.name.toLowerCase())) {
            seen.add(pivot.name.toLowerCase());
            withUrl.push({ name: pivot.name, url: pivot.url });
          }
        }
      }

      // Related Interests
      if (idea.related_interests) {
        for (const interest of idea.related_interests) {
          if (interest.url && !seen.has(interest.name.toLowerCase())) {
            seen.add(interest.name.toLowerCase());
            withUrl.push({ name: interest.name, url: interest.url });
          }
        }
      }

      // Top Annotations (extract URLs from href)
      if (idea.top_annotations) {
        const regex = /<a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
        let match;
        while ((match = regex.exec(idea.top_annotations)) !== null) {
          const url = match[1];
          const name = match[2];
          if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            if (url && url.includes('/ideas/')) {
              withUrl.push({ name, url: url.startsWith('http') ? url : `https://www.pinterest.com${url}` });
            } else {
              withoutUrl.push(name);
            }
          }
        }
      }

      // Pin Annotations (names only)
      for (const pin of pins) {
        if (pin.annotations) {
          for (const annotation of pin.annotations) {
            if (!seen.has(annotation.toLowerCase())) {
              seen.add(annotation.toLowerCase());
              withoutUrl.push(annotation);
            }
          }
        }
      }

      const allItems = [
        ...withUrl.map(item => ({ ...item, hasUrl: true as const })),
        ...withoutUrl.map(name => ({ name, url: '', hasUrl: false as const })),
      ];

      annotationStats.total = allItems.length;
      annotationStats.skipped = Math.max(0, allItems.length - maxAnnotations);

      // Scrape up to maxAnnotations items
      const toScrape = allItems.slice(0, maxAnnotations);

      for (const item of toScrape) {
        try {
          let result;

          if (item.hasUrl && item.url) {
            // Direct scrape
            const resp = await scrapePinterestIdea(item.url, {
              acceptLanguage: langConfig.acceptLanguage,
              pinterestDomain: langConfig.pinterestDomain,
              language: langConfig.languageCode,
            });
            if (resp.success && resp.idea) {
              const sr = await saveIdeaToDb(resp.idea);
              try { if (resp.pins) await savePinsToDb(resp.idea.id, resp.pins); } catch { /* non-critical */ }
              result = sr;
            } else {
              annotationStats.failed++;
              continue;
            }
          } else {
            // Find or scrape by name — check DB first, then construct URL
            const { data: existing } = await supabase
              .from('ideas')
              .select('id')
              .ilike('name', item.name)
              .limit(1)
              .single();

            if (existing) {
              annotationStats.existingUpdated++;
              annotationStats.scraped++;
              continue;
            }

            // Construct Pinterest URL and try to scrape
            const slug = item.name.toLowerCase()
              .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');

            const tryUrl = `https://${langConfig.pinterestDomain}/ideas/${slug}/`;

            try {
              const resp = await scrapePinterestIdea(tryUrl, {
                acceptLanguage: langConfig.acceptLanguage,
                pinterestDomain: langConfig.pinterestDomain,
                language: langConfig.languageCode,
              });

              if (resp.success && resp.idea) {
                result = await saveIdeaToDb(resp.idea);
                try { if (resp.pins) await savePinsToDb(resp.idea.id, resp.pins); } catch { /* non-critical */ }
              } else {
                annotationStats.failed++;
                continue;
              }
            } catch {
              annotationStats.failed++;
              continue;
            }
          }

          if (result) {
            annotationStats.scraped++;
            if (result.isNew) annotationStats.newCreated++;
            else annotationStats.existingUpdated++;
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch {
          annotationStats.failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      idea: {
        id: idea.id,
        name: idea.name,
        searches: idea.searches,
        language: idea.language,
        isNew: saveResult.isNew,
      },
      candidate: {
        score: candidate.score,
        pivot_count: candidate.pivot_count,
        related_count: candidate.related_count,
      },
      annotations: annotationStats,
    });
  } catch (error) {
    console.error('Auto-scrape error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: `Auto-scrape failed: ${message}` }, { status: 500 });
  }
}
