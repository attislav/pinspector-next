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

interface AnnotationItem {
  name: string;
  url: string;
  hasUrl: boolean;
  source: string;
}

interface ScrapeOptions {
  newKw: boolean;
  kwOnly: string | null;
  kwExclude: string | null;
}

function isOutdatedKeyword(name: string): boolean {
  const currentYear = new Date().getFullYear();
  const yearMatch = name.match(/\b(20\d{2})\b/);
  if (!yearMatch) return false;
  const year = parseInt(yearMatch[1]);
  return year < currentYear;
}

async function updateLog(logId: number, data: Record<string, unknown>) {
  const supabase = getSupabase();
  await supabase.from('sync_log').update(data).eq('id', logId);
}

async function appendDebugLog(logId: number, line: string) {
  const supabase = getSupabase();
  const timestamp = new Date().toISOString().slice(11, 19);
  const { data } = await supabase.from('sync_log').select('debug_log').eq('id', logId).single();
  const existing = data?.debug_log || '';
  const updated = existing + `[${timestamp}] ${line}\n`;
  await supabase.from('sync_log').update({ debug_log: updated }).eq('id', logId);
}

function collectAnnotations(
  idea: Idea,
  pins: Pin[],
  options: ScrapeOptions,
): AnnotationItem[] {
  const seen = new Set<string>();
  const withUrl: AnnotationItem[] = [];
  const withoutUrl: AnnotationItem[] = [];

  const shouldInclude = (name: string): boolean => {
    if (seen.has(name.toLowerCase())) return false;
    if (isOutdatedKeyword(name)) return false;
    if (options.kwOnly && !name.toLowerCase().includes(options.kwOnly.toLowerCase())) return false;
    if (options.kwExclude && name.toLowerCase().includes(options.kwExclude.toLowerCase())) return false;
    return true;
  };

  // KLP Pivots
  if (idea.klp_pivots) {
    for (const pivot of idea.klp_pivots) {
      if (pivot.url && shouldInclude(pivot.name)) {
        seen.add(pivot.name.toLowerCase());
        withUrl.push({ name: pivot.name, url: pivot.url, hasUrl: true, source: 'klp_pivot' });
      }
    }
  }

  // Related Interests
  if (idea.related_interests) {
    for (const interest of idea.related_interests) {
      if (interest.url && shouldInclude(interest.name)) {
        seen.add(interest.name.toLowerCase());
        withUrl.push({ name: interest.name, url: interest.url, hasUrl: true, source: 'related' });
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
      if (shouldInclude(name)) {
        seen.add(name.toLowerCase());
        if (url && url.includes('/ideas/')) {
          withUrl.push({ name, url: url.startsWith('http') ? url : `https://www.pinterest.com${url}`, hasUrl: true, source: 'top_annotation' });
        } else {
          withoutUrl.push({ name, url: '', hasUrl: false, source: 'top_annotation' });
        }
      }
    }
  }

  // Pin Annotations (names only)
  for (const pin of pins) {
    if (pin.annotations) {
      for (const annotation of pin.annotations) {
        if (shouldInclude(annotation)) {
          seen.add(annotation.toLowerCase());
          withoutUrl.push({ name: annotation, url: '', hasUrl: false, source: 'pin_annotation' });
        }
      }
    }
  }

  return [...withUrl, ...withoutUrl];
}

async function prioritizeByExistence(items: AnnotationItem[]): Promise<{ sorted: AnnotationItem[]; missingCount: number; existingCount: number }> {
  const supabase = getSupabase();

  const allNames = items.map(item => item.name);
  const allIds: string[] = [];
  for (const item of items) {
    if (item.hasUrl && item.url) {
      const idMatch = item.url.match(/\/ideas\/[^/]+\/(\d+)/);
      if (idMatch) allIds.push(idMatch[1]);
    }
  }

  const existingIdSet = new Set<string>();
  const existingNameSet = new Set<string>();

  if (allIds.length > 0) {
    const { data } = await supabase.from('ideas').select('id').in('id', allIds);
    if (data) data.forEach(row => existingIdSet.add(row.id));
  }

  if (allNames.length > 0) {
    for (let i = 0; i < allNames.length; i += 50) {
      const batch = allNames.slice(i, i + 50);
      const orFilter = batch.map(n => `name.ilike.${n}`).join(',');
      const { data } = await supabase.from('ideas').select('name').or(orFilter);
      if (data) data.forEach(row => existingNameSet.add(row.name.toLowerCase()));
    }
  }

  const isMissing = (item: AnnotationItem) => {
    if (item.hasUrl && item.url) {
      const idMatch = item.url.match(/\/ideas\/[^/]+\/(\d+)/);
      if (idMatch && existingIdSet.has(idMatch[1])) return false;
    }
    if (existingNameSet.has(item.name.toLowerCase())) return false;
    return true;
  };

  const missing = items.filter(isMissing);
  const existing = items.filter(item => !isMissing(item));

  return { sorted: [...missing, ...existing], missingCount: missing.length, existingCount: existing.length };
}

async function scrapeAnnotations(
  idea: Idea,
  pins: Pin[],
  langConfig: ReturnType<typeof getLanguageConfig>,
  maxAnnotations: number,
  logId: number,
  options: ScrapeOptions,
) {
  const supabase = getSupabase();
  const stats = { total: 0, scraped: 0, newCreated: 0, existingUpdated: 0, failed: 0, filtered: 0, skippedExisting: 0 };

  const allItems = collectAnnotations(idea, pins, options);
  stats.total = allItems.length;

  await appendDebugLog(logId, `Collected ${allItems.length} annotations (kwOnly=${options.kwOnly || 'none'}, kwExclude=${options.kwExclude || 'none'})`);

  let toScrape: AnnotationItem[];

  if (options.newKw) {
    const { sorted, missingCount, existingCount } = await prioritizeByExistence(allItems);
    await appendDebugLog(logId, `Prioritization: ${missingCount} missing, ${existingCount} existing`);
    toScrape = sorted.slice(0, maxAnnotations);
  } else {
    toScrape = allItems.slice(0, maxAnnotations);
  }

  await appendDebugLog(logId, `Scraping ${toScrape.length} of ${allItems.length} annotations`);

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
          await appendDebugLog(logId, `FAIL [${item.source}] "${item.name}" - ${resp.error || 'unknown error'}`);
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

        // Construct slug-only URL and follow Pinterest's redirect to get the real URL with ID
        const slug = item.name.toLowerCase()
          .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const urlsToTry = [
          `https://${langConfig.pinterestDomain}/ideas/${slug}/`,
          `https://www.pinterest.com/ideas/${slug}/`,
        ];

        let resolved = false;
        for (const tryUrl of urlsToTry) {
          try {
            // Follow redirect to get the real URL with numeric ID
            const redirectResp = await fetch(tryUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': langConfig.acceptLanguage,
              },
              redirect: 'follow',
            });

            const finalUrl = redirectResp.url;
            if (!finalUrl.match(/\/ideas\/[^/]+\/\d+/)) continue;

            const resp = await scrapePinterestIdea(finalUrl, {
              acceptLanguage: langConfig.acceptLanguage,
              pinterestDomain: langConfig.pinterestDomain,
              language: langConfig.languageCode,
            });
            if (resp.success && resp.idea) {
              result = await saveIdeaToDb(resp.idea);
              try { if (resp.pins) await savePinsToDb(resp.idea.id, resp.pins); } catch { /* non-critical */ }
              resolved = true;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!resolved) {
          stats.failed++;
          await appendDebugLog(logId, `FAIL [${item.source}] "${item.name}" (slug: ${slug}) - not found on Pinterest`);
          continue;
        }
      }

      if (result) {
        stats.scraped++;
        if (result.isNew) stats.newCreated++;
        else stats.existingUpdated++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      stats.failed++;
      await appendDebugLog(logId, `FAIL "${item.name}" - ${e instanceof Error ? e.message : 'exception'}`);
    }
  }

  await appendDebugLog(logId, `Done: ${stats.scraped} scraped, ${stats.newCreated} new, ${stats.existingUpdated} updated, ${stats.failed} failed`);

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
    const newKw: boolean = body.newKw === true;
    const kwOnly: string | null = body.kwOnly || null;
    const kwExclude: string | null = body.kwExclude || null;
    const minSearches: number = body.minSearches || 1;
    const dryRun: boolean = body.dryRun === true;

    const supabase = getSupabase();

    // Step 1: Pick the best candidate
    const { data: candidates, error: rpcError } = await supabase.rpc('get_auto_scrape_candidate', {
      p_language: language,
      p_min_age_days: minAgeDays,
      p_name_contains: kw,
      p_min_searches: minSearches,
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

    // Dry Run: show what would be scraped without actually doing it
    if (dryRun) {
      // Fetch the idea data to preview annotations
      const { data: ideaData } = await supabase
        .from('ideas')
        .select('*')
        .eq('id', candidate.id)
        .single();

      const { data: pinsData } = await supabase
        .from('pins')
        .select('*')
        .in('id', (
          await supabase.from('idea_pins').select('pin_id').eq('idea_id', candidate.id)
        ).data?.map(r => r.pin_id) || []);

      const options: ScrapeOptions = { newKw, kwOnly, kwExclude };
      const allItems = collectAnnotations(ideaData as Idea, (pinsData || []) as Pin[], options);

      let preview: { name: string; source: string; hasUrl: boolean; isMissing?: boolean }[];

      if (newKw) {
        const { sorted, missingCount, existingCount } = await prioritizeByExistence(allItems);
        preview = sorted.slice(0, maxAnnotations).map(item => ({
          name: item.name,
          source: item.source,
          hasUrl: item.hasUrl,
        }));
        // Mark missing/existing
        const missingItems = sorted.slice(0, missingCount);
        preview = sorted.slice(0, maxAnnotations).map(item => ({
          name: item.name,
          source: item.source,
          hasUrl: item.hasUrl,
          isMissing: missingItems.some(m => m.name === item.name),
        }));

        return NextResponse.json({
          success: true,
          dryRun: true,
          candidate: {
            id: candidate.id,
            name: candidate.name,
            searches: candidate.searches,
            score: candidate.score,
            pivot_count: candidate.pivot_count,
            related_count: candidate.related_count,
          },
          annotations: {
            total: allItems.length,
            wouldScrape: preview.length,
            missing: missingCount,
            existing: existingCount,
            items: preview,
          },
          filters: { kwOnly, kwExclude, newKw, minSearches },
        });
      }

      preview = allItems.slice(0, maxAnnotations).map(item => ({
        name: item.name,
        source: item.source,
        hasUrl: item.hasUrl,
      }));

      return NextResponse.json({
        success: true,
        dryRun: true,
        candidate: {
          id: candidate.id,
          name: candidate.name,
          searches: candidate.searches,
          score: candidate.score,
          pivot_count: candidate.pivot_count,
          related_count: candidate.related_count,
        },
        annotations: {
          total: allItems.length,
          wouldScrape: preview.length,
          items: preview,
        },
        filters: { kwOnly, kwExclude, newKw, minSearches },
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
    const scrapeOptions: ScrapeOptions = { newKw, kwOnly, kwExclude };

    // Step 3: Respond immediately, scrape in background
    after(async () => {
      try {
        await appendDebugLog(logId, `Started scraping: ${candidate.name} (${candidate.url})`);
        await appendDebugLog(logId, `Options: newKw=${newKw}, kwOnly=${kwOnly || 'none'}, kwExclude=${kwExclude || 'none'}, maxAnnotations=${maxAnnotations}`);

        // Scrape the main idea
        const scrapeResult = await scrapePinterestIdea(candidate.url, {
          acceptLanguage: langConfig.acceptLanguage,
          pinterestDomain: langConfig.pinterestDomain,
          language: langConfig.languageCode,
        });

        if (!scrapeResult.success || !scrapeResult.idea) {
          await appendDebugLog(logId, `Main scrape FAILED: ${scrapeResult.error}`);
          await updateLog(logId, {
            status: 'failed',
            error: `Scrape failed: ${scrapeResult.error}`,
            completed_at: new Date().toISOString(),
          });
          return;
        }

        const idea = scrapeResult.idea;
        const pins = scrapeResult.pins || [];

        await appendDebugLog(logId, `Main scrape OK: "${idea.name}" (${idea.searches} searches, ${pins.length} pins)`);

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
          await scrapeAnnotations(idea, pins, langConfig, maxAnnotations, logId, scrapeOptions);
        } else {
          await appendDebugLog(logId, 'scrapeRelated=false, skipping annotations');
          await updateLog(logId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await appendDebugLog(logId, `FATAL ERROR: ${message}`);
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
      filters: { newKw, kwOnly, kwExclude, minSearches },
      message: 'Scrape started in background. Check /sync-log for progress.',
    });
  } catch (error) {
    console.error('Auto-scrape error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: `Auto-scrape failed: ${message}` }, { status: 500 });
  }
}
