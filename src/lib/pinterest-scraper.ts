import { Idea, RelatedInterest, ScrapeResult, Pin, KlpPivot } from '@/types/database';

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Extract ID from Pinterest Ideas URL
export function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/ideas\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}

// Validate Pinterest Ideas URL
export function isValidPinterestIdeasUrl(url: string): boolean {
  return /^https?:\/\/([a-z]{2}\.)?((www\.)?pinterest\.[a-z.]+)\/ideas\/[^/]+\/\d+/.test(url);
}

// Normalize URL to the target Pinterest domain (language-aware)
function normalizeUrl(url: string, targetDomain?: string): string {
  if (targetDomain) {
    return url.replace(/https?:\/\/([a-z]{2}\.)?(www\.)?pinterest\.[a-z.]+/, `https://${targetDomain}`);
  }
  // Fallback: keep original domain
  return url;
}

export interface ScrapeOptions {
  acceptLanguage?: string;
  pinterestDomain?: string;
}

// Parse Pinterest Ideas page and extract data
export async function scrapePinterestIdea(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
  try {
    // Normalize URL
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    if (!isValidPinterestIdeasUrl(url)) {
      return { success: false, error: 'Ungültige Pinterest Ideas URL' };
    }

    const id = extractIdFromUrl(url);
    if (!id) {
      return { success: false, error: 'Konnte ID nicht aus URL extrahieren' };
    }

    // Normalize to the target Pinterest domain for language-correct data
    const normalizedUrl = normalizeUrl(url, options?.pinterestDomain);

    // Fetch the page with 15s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': options?.acceptLanguage ?? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        return { success: false, error: 'Zeitüberschreitung beim Laden der Pinterest-Seite (15s)' };
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { success: false, error: `HTTP Error: ${response.status}` };
    }

    const html = await response.text();

    // Extract JSON from __PWS_INITIAL_PROPS__ script tag
    const scriptMatch = html.match(
      /<script id="__PWS_INITIAL_PROPS__"[^>]*>(.*?)<\/script>/s
    );

    if (!scriptMatch) {
      return { success: false, error: 'Keine Pinterest-Daten gefunden (PWS_INITIAL_PROPS fehlt)' };
    }

    let jsonData: any;
    try {
      jsonData = JSON.parse(scriptMatch[1]);
    } catch (e) {
      return { success: false, error: 'Fehler beim Parsen der Pinterest-Daten' };
    }

    // Navigate to InterestResource
    const resources = jsonData?.initialReduxState?.resources;
    if (!resources?.InterestResource) {
      return { success: false, error: 'InterestResource nicht gefunden' };
    }

    // Get the first (and usually only) key in InterestResource
    const interestResourceKey = Object.keys(resources.InterestResource)[0];
    const interestData = resources.InterestResource[interestResourceKey]?.data;

    if (!interestData) {
      return { success: false, error: 'Interest-Daten nicht gefunden' };
    }

    // Extract keyword name from metatags
    const name = interestData.page_metadata?.metatags?.['og:title'] ||
                 interestData.name ||
                 '';

    if (!name) {
      return { success: false, error: 'Konnte keinen Namen extrahieren' };
    }

    // Extract search volume
    const searches = interestData.internal_search_count || 0;

    // Extract breadcrumbs (categories)
    const seoBreadcrumbs: string[] = (interestData.seo_breadcrumbs || [])
      .map((b: any) => b.name)
      .filter(Boolean);

    // Extract related interests
    const baseDomain = options?.pinterestDomain || 'www.pinterest.com';
    const relatedInterests: RelatedInterest[] = (interestData.seo_related_interests || [])
      .map((i: any) => ({
        name: i.name,
        url: i.url?.startsWith('http')
          ? i.url
          : `https://${baseDomain}${i.url || `/ideas/${i.key}/`}`,
        id: i.id,
      }))
      .filter((i: RelatedInterest) => i.name);

    // Extract bubble keywords (ideas_klp_pivots)
    const klpPivots: KlpPivot[] = (interestData.ideas_klp_pivots || [])
      .filter((p: any) => p.pivot_full_name && p.pivot_url)
      .map((p: any) => ({
        name: p.pivot_full_name,
        url: p.pivot_url?.startsWith('http')
          ? p.pivot_url
          : `https://${baseDomain}${p.pivot_url}`,
      }));

    // Extract annotations from pins
    const pins = jsonData?.initialReduxState?.pins || {};
    const annotationCounts = new Map<string, { count: number; url: string }>();

    for (const pin of Object.values(pins) as any[]) {
      const annotationsRaw = pin?.pin_join?.annotations_with_links;
      if (!annotationsRaw) continue;

      let annotationsArray: any[] = [];

      if (Array.isArray(annotationsRaw)) {
        annotationsArray = annotationsRaw.flat();
      } else if (typeof annotationsRaw === 'object') {
        annotationsArray = Object.values(annotationsRaw);
      }

      // Filter valid annotations
      for (const item of annotationsArray) {
        if (!item?.name || !item?.url) continue;

        const hasIdeas = item.url.includes('/ideas/');
        const endsWithNumber = /\/\d+\/?$/.test(item.url);
        const noParentheses = !item.url.includes('(') && !item.url.includes(')');

        if (hasIdeas && endsWithNumber && noParentheses) {
          const current = annotationCounts.get(item.name) || { count: 0, url: item.url };
          annotationCounts.set(item.name, { count: current.count + 1, url: item.url });
        }
      }
    }

    // Get top annotations sorted by frequency
    const topAnnotationsList = Array.from(annotationCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    // Format as HTML links (matching original format)
    const topAnnotations = topAnnotationsList
      .map(([name, data]) => `<a href="${data.url}" target="_blank">${name}</a> (${data.count})`)
      .join(', ');

    // Extract Pins (up to 20)
    const now = new Date().toISOString();
    let pinIndex = 0;
    const extractedPins: Pin[] = Object.values(pins as Record<string, any>)
      .slice(0, 20)
      .map((pin: any) => {
        pinIndex++;
        // Extract annotations for this pin
        const pinAnnotations: string[] = [];
        const annotationsRaw = pin?.pin_join?.annotations_with_links;
        if (annotationsRaw) {
          const annotationsArray = Array.isArray(annotationsRaw)
            ? annotationsRaw.flat()
            : Object.values(annotationsRaw);
          for (const item of annotationsArray) {
            if (item?.name) {
              pinAnnotations.push(item.name);
            }
          }
        }

        // Get image URLs (different sizes)
        const images = pin?.images;
        const imageUrl = images?.['736x']?.url ||
                         images?.['564x']?.url ||
                         images?.['474x']?.url ||
                         images?.orig?.url ||
                         null;
        const thumbnailUrl = images?.['236x']?.url ||
                             images?.['170x']?.url ||
                             images?.['136x136']?.url ||
                             null;

        // Get article/rich pin link (try multiple paths)
        const articleUrl = pin?.rich_summary?.url ||
                           pin?.rich_metadata?.url ||
                           pin?.rich_metadata?.article?.url ||
                           pin?.link ||
                           pin?.attribution?.url ||
                           pin?.tracked_link ||
                           null;

        // Get pin created date (try multiple paths and formats)
        let pinCreatedAt = pin?.created_at ||
                           pin?.created_time ||
                           pin?.date_created ||
                           pin?.native_creator?.created_at ||
                           null;

        // Pinterest sometimes uses Unix timestamps (seconds)
        if (pinCreatedAt && typeof pinCreatedAt === 'number') {
          // If it's a Unix timestamp (before year 2100 in seconds)
          if (pinCreatedAt < 4102444800) {
            pinCreatedAt = new Date(pinCreatedAt * 1000).toISOString();
          } else {
            // Already in milliseconds
            pinCreatedAt = new Date(pinCreatedAt).toISOString();
          }
        }

        // Get comment count
        const commentCount = pin?.comment_count ||
                             pin?.aggregated_pin_data?.comment_count ||
                             pin?.aggregated_pin_data?.aggregated_stats?.comments ||
                             0;

        // Extract domain
        const domain = pin?.domain || null;

        return {
          id: pin?.id || '',
          title: pin?.title || pin?.grid_title || null,
          description: pin?.description || pin?.closeup_description || null,
          image_url: imageUrl,
          image_thumbnail_url: thumbnailUrl,
          link: pin?.id ? `https://www.pinterest.com/pin/${pin.id}/` : null,
          article_url: articleUrl,
          repin_count: pin?.repin_count || 0,
          save_count: pin?.aggregated_pin_data?.aggregated_stats?.saves || 0,
          comment_count: commentCount,
          annotations: pinAnnotations.slice(0, 10), // Limit to 10 annotations per pin
          pin_created_at: pinCreatedAt,
          domain: domain,
          last_scrape: now,
          created_at: now,
        };
      })
      .filter((pin: Pin) => pin.id); // Only include pins with valid IDs

    // Get last update time
    const lastUpdate = interestData.page_metadata?.metatags?.['og:updated_time'] ||
                       new Date().toISOString();

    const idea: Idea = {
      id,
      name,
      url: url, // Keep original URL
      searches,
      last_update: lastUpdate,
      last_scrape: now,
      related_interests: relatedInterests,
      top_annotations: topAnnotations,
      seo_breadcrumbs: seoBreadcrumbs,
      klp_pivots: klpPivots,
      created_at: now,
    };

    return { success: true, idea, pins: extractedPins };
  } catch (error) {
    console.error('Scrape error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Scrapen'
    };
  }
}

// Batch scrape multiple URLs with rate limiting
export async function scrapeBatch(urls: string[], options?: ScrapeOptions): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const result = await scrapePinterestIdea(urls[i], options);
    results.push(result);

    // Rate limiting: 2-3 seconds between requests
    if (i < urls.length - 1) {
      const delay = 2000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}
