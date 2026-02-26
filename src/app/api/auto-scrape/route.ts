import { NextRequest, NextResponse, after } from 'next/server';
import { getSupabase } from '@/lib/db';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';
import { getLanguageConfig } from '@/lib/language-config';
import { Idea, Pin } from '@/types/database';

export const maxDuration = 300;

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

function isOutdatedKeyword(name: string): boolean {
  const currentYear = new Date().getFullYear();
  const yearMatch = name.match(/\b(20\d{2})\b/);
  if (!yearMatch) return false;
  const year = parseInt(yearMatch[1]);
  // Allow current year and next year, filter everything older
  return year < currentYear;
}

async function updateLog(logId: number, data: Record<string, unknown>) {
  const supabase = getSupabase();
  await supabase.from('sync_log').update(data).eq('id', logId);
}

async function scrapeAnnotations(
  idea: Idea,
  pins: Pin[],
  langConfig: ReturnType<typeof getLanguageConfig>,
  maxAnnotations: number,
  logId: number,
) {
  const supabase = getSupabase();
  const stats = { total: 0, scraped: 0, newCreated: 0, existingUpdated: 0, failed: 0 };

  // Collect all unique items from all sources, deduplicated by name
  const seen = new Set<string>();
  const withUrl: { name: string; url: string }[] = [];
  const withoutUrl: string[] = [];

  // KLP Pivots
  if (idea.klp_pivots) {
    for (const pivot of idea.klp_pivots) {
      if (pivot.url && !seen.has(pivot.name.toLowerCase()) && !isOutdatedKeyword(pivot.name)) {
        seen.add(pivot.name.toLowerCase());
        withUrl.push({ name: pivot.name, url: pivot.url });
      }
    }
  }

  // Related Interests
  if (idea.related_interests) {
    for (const interest of idea.related_interests) {
      if (interest.url && !seen.has(interest.name.toLowerCase()) && !isOutdatedKeyword(interest.name)) {
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
      if (!seen.has(name.toLowerCase()) && !isOutdatedKeyword(name)) {
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
        if (!seen.has(annotation.toLowerCase()) && !isOutdatedKeyword(annotation)) {
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

  stats.total = allItems.length;
  const toScrape = allItems.slice(0, maxAnnotations);

  for (const item of toScrape) {
    try {
      let result;

      if (item.hasUrl && item.url) {
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
          stats.failed++;
          continue;
        }
      } else {
        // Check DB first
        const { data: existing } = await supabase
          .from('ideas')
          .select('id')
          .ilike('name', item.name)
          .limit(1)
          .single();

        if (existing) {
          stats.existingUpdated++;
          stats.scraped++;
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
            stats.failed++;
            continue;
          }
        } catch {
          stats.failed++;
          continue;
        }
      }

      if (result) {
        stats.scraped++;
        if (result.isNew) stats.newCreated++;
        else stats.existingUpdated++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch {
      stats.failed++;
    }
  }

  // Update log with final stats
  await updateLog(logId, {
    annotations_total: stats.total,
    annotations_scraped: stats.scraped,
    new_created: stats.newCreated,
    existing_updated: stats.existingUpdated,
    failed: stats.failed,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return stats;
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
    const maxAnnotations: number = Math.min(body.maxAnnotations || 50, 100);
    const scrapeRelated: boolean = body.scrapeRelated !== false;
    const kw: string | null = body.kw || null;

    const supabase = getSupabase();

    // Step 1: Pick the best candidate
    const { data: candidates, error: rpcError } = await supabase.rpc('get_auto_scrape_candidate', {
      p_language: language,
      p_min_age_days: minAgeDays,
      p_name_contains: kw,
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

    // Step 2: Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('sync_log')
      .insert({
        status: 'running',
        idea_id: candidate.id,
        idea_name: candidate.name,
        idea_searches: candidate.searches,
        language,
        score: candidate.score,
      })
      .select('id')
      .single();

    if (logError || !logEntry) {
      return NextResponse.json({ success: false, error: `Log error: ${logError?.message}` }, { status: 500 });
    }

    const logId = logEntry.id;
    const langConfig = getLanguageConfig(language);

    // Step 3: Respond immediately, scrape in background
    after(async () => {
      try {
        // Scrape the main idea
        const scrapeResult = await scrapePinterestIdea(candidate.url, {
          acceptLanguage: langConfig.acceptLanguage,
          pinterestDomain: langConfig.pinterestDomain,
          language: langConfig.languageCode,
        });

        if (!scrapeResult.success || !scrapeResult.idea) {
          await updateLog(logId, {
            status: 'failed',
            error: `Scrape failed: ${scrapeResult.error}`,
            completed_at: new Date().toISOString(),
          });
          return;
        }

        const idea = scrapeResult.idea;
        const pins = scrapeResult.pins || [];

        // Save idea + pins
        await saveIdeaToDb(idea);
        try { await savePinsToDb(idea.id, pins); } catch { /* non-critical */ }

        // Update log with idea data
        await updateLog(logId, {
          idea_id: idea.id,
          idea_name: idea.name,
          idea_searches: idea.searches,
        });

        // Scrape annotations
        if (scrapeRelated) {
          await scrapeAnnotations(idea, pins, langConfig, maxAnnotations, logId);
        } else {
          await updateLog(logId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await updateLog(logId, {
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
        });
      }
    });

    // Immediate response
    return NextResponse.json({
      success: true,
      logId,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        searches: candidate.searches,
        score: candidate.score,
        pivot_count: candidate.pivot_count,
        related_count: candidate.related_count,
      },
      message: 'Scrape started in background. Check /sync-log for progress.',
    });
  } catch (error) {
    console.error('Auto-scrape error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: `Auto-scrape failed: ${message}` }, { status: 500 });
  }
}
