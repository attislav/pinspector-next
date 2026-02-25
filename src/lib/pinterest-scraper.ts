import { Idea, RelatedInterest, ScrapeResult, Pin, KlpPivot, PinDetail, PinDetailResult } from '@/types/database';

// User agents for rotation (keep these up-to-date with current browser versions)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
  language?: string;
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': options?.acceptLanguage ?? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1',
        },
        cache: 'no-store',
        redirect: 'follow',
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
      if (response.status === 403) {
        return { success: false, error: 'Pinterest hat die Anfrage blockiert (403 Forbidden). Möglicherweise Bot-Erkennung.' };
      }
      if (response.status === 429) {
        return { success: false, error: 'Pinterest Rate-Limit erreicht (429). Bitte später erneut versuchen.' };
      }
      return { success: false, error: `HTTP Error: ${response.status}` };
    }

    // Check if we were redirected to a login or challenge page
    const finalUrl = response.url;
    if (finalUrl && (finalUrl.includes('/login') || finalUrl.includes('/challenge'))) {
      return { success: false, error: 'Pinterest hat auf Login/Challenge umgeleitet. Seite nicht öffentlich zugänglich.' };
    }

    const html = await response.text();

    // Try multiple script tags: Pinterest uses __PWS_INITIAL_PROPS__ or __PWS_DATA__
    let scriptMatch = html.match(
      /<script id="__PWS_INITIAL_PROPS__"[^>]*>(.*?)<\/script>/s
    );
    let dataSource = '__PWS_INITIAL_PROPS__';

    if (!scriptMatch) {
      scriptMatch = html.match(
        /<script id="__PWS_DATA__"[^>]*>(.*?)<\/script>/s
      );
      dataSource = '__PWS_DATA__';
    }

    if (!scriptMatch) {
      // Check if we got a challenge page or login redirect
      const isChallenge = html.includes('challenge') || html.includes('login');
      const isBlocked = html.includes('blocked') || html.includes('captcha');
      if (isChallenge) {
        return { success: false, error: 'Pinterest verlangt eine Challenge/Login-Verifizierung' };
      }
      if (isBlocked) {
        return { success: false, error: 'Pinterest hat die Anfrage blockiert (Bot-Erkennung)' };
      }
      return { success: false, error: 'Keine Pinterest-Daten gefunden (weder PWS_INITIAL_PROPS noch PWS_DATA vorhanden)' };
    }

    let jsonData: any;
    try {
      jsonData = JSON.parse(scriptMatch[1]);
    } catch (e) {
      return { success: false, error: `Fehler beim Parsen der Pinterest-Daten (${dataSource})` };
    }

    // Navigate to InterestResource - try multiple data paths
    // Path 1: jsonData.initialReduxState.resources (from __PWS_INITIAL_PROPS__)
    // Path 2: jsonData.props.initialReduxState.resources (from __PWS_DATA__)
    // Path 3: jsonData.props.context.initialReduxState.resources (newer format)
    const reduxState = jsonData?.initialReduxState
      || jsonData?.props?.initialReduxState
      || jsonData?.props?.context?.initialReduxState;

    if (!reduxState) {
      return { success: false, error: `Pinterest Redux-State nicht gefunden in ${dataSource} (geprüfte Pfade: initialReduxState, props.initialReduxState, props.context.initialReduxState)` };
    }

    const resources = reduxState?.resources;
    if (!resources?.InterestResource) {
      // Try alternative resource names
      const interestRes = resources?.InterestResource
        || resources?.InterestPageResource
        || resources?.TopicResource;
      if (!interestRes) {
        const availableResources = resources ? Object.keys(resources).join(', ') : 'keine';
        return { success: false, error: `InterestResource nicht gefunden. Verfügbare Resources: ${availableResources}` };
      }
      resources.InterestResource = interestRes;
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
    const pins = reduxState?.pins || {};
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
    // Log first pin's board-related keys for debugging
    const firstPin = Object.values(pins as Record<string, any>)[0];
    if (firstPin) {
      const boardKeys = Object.keys(firstPin).filter(k =>
        k.includes('board') || k.includes('pinner') || k.includes('creator')
      );
      console.log('Pinterest pin board-related keys:', boardKeys);
      if (firstPin.board) console.log('Pinterest pin.board keys:', Object.keys(firstPin.board));
    }
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

        // Extract board name (try multiple Pinterest data paths)
        const boardName = pin?.board?.name
          || pin?.board?.title
          || pin?.pin_join?.board?.name
          || pin?.native_creator?.board_name
          || null;

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
          board_name: boardName,
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
      language: options?.language || null,
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

// Extract pin ID from a Pinterest pin URL
export function extractPinIdFromUrl(url: string): string | null {
  const match = url.match(/\/pin\/(\d+)/);
  return match ? match[1] : null;
}

// Validate Pinterest pin URL
export function isValidPinterestPinUrl(url: string): boolean {
  return /^https?:\/\/([a-z]{2}\.)?(www\.)?pinterest\.[a-z.]+\/pin\/\d+/.test(url);
}

// Parse a Pinterest pin page and extract all available data including annotations
// Uses multiple extraction strategies:
// 1. v3GetPinQuery from <script type="application/json"> blocks (best for annotations)
// 2. Redux state from __PWS_INITIAL_PROPS__ / __PWS_DATA__ (fallback for pin data)
export async function scrapePinterestPin(pinId: string, options?: ScrapeOptions): Promise<PinDetailResult> {
  try {
    const domain = options?.pinterestDomain || 'www.pinterest.com';
    const url = `https://${domain}/pin/${pinId}/`;

    // Fetch the pin page with 15s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': options?.acceptLanguage ?? 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1',
        },
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        return { success: false, error: 'Timeout beim Laden der Pinterest-Pin-Seite (15s)' };
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 403) {
        return { success: false, error: 'Pinterest hat die Anfrage blockiert (403 Forbidden)' };
      }
      if (response.status === 404) {
        return { success: false, error: `Pin ${pinId} nicht gefunden (404)` };
      }
      if (response.status === 429) {
        return { success: false, error: 'Pinterest Rate-Limit erreicht (429)' };
      }
      return { success: false, error: `HTTP Error: ${response.status}` };
    }

    const finalUrl = response.url;
    if (finalUrl && (finalUrl.includes('/login') || finalUrl.includes('/challenge'))) {
      return { success: false, error: 'Pinterest hat auf Login/Challenge umgeleitet' };
    }

    const html = await response.text();

    // === Strategy 1: Extract annotations from v3GetPinQuery ===
    // Pinterest delivers annotations in <script type="application/json"> blocks
    // at path: response.data.v3GetPinQuery.data.pinJoin.annotationsWithLinksArray
    let annotations: { name: string; url: string }[] = [];
    let v3PinData: any = null;

    const scriptRegex = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g;
    let scriptMatch: RegExpExecArray | null;

    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
      try {
        const block = JSON.parse(scriptMatch[1]);
        const pinQuery = block?.response?.data?.v3GetPinQuery?.data;
        if (pinQuery) {
          v3PinData = pinQuery;
          const annotationsRaw = pinQuery?.pinJoin?.annotationsWithLinksArray;
          if (Array.isArray(annotationsRaw)) {
            annotations = annotationsRaw
              .filter((a: any) => a?.name && a?.url)
              .map((a: any) => ({
                name: a.name,
                url: a.url.startsWith('http') ? a.url : `https://${domain}${a.url}`,
              }));
          }
          break;
        }
      } catch {
        // Skip invalid JSON blocks
      }
    }

    // === Strategy 2: Extract pin data from Redux state ===
    let reduxMatch = html.match(
      /<script id="__PWS_INITIAL_PROPS__"[^>]*>(.*?)<\/script>/s
    );
    if (!reduxMatch) {
      reduxMatch = html.match(
        /<script id="__PWS_DATA__"[^>]*>(.*?)<\/script>/s
      );
    }

    let pin: any = null;

    if (reduxMatch) {
      try {
        const jsonData = JSON.parse(reduxMatch[1]);
        const reduxState = jsonData?.initialReduxState
          || jsonData?.props?.initialReduxState
          || jsonData?.props?.context?.initialReduxState;

        if (reduxState) {
          // Try multiple locations for pin data
          const pinsMap = reduxState?.pins || {};
          pin = pinsMap[pinId] || (Object.keys(pinsMap).length > 0 ? Object.values(pinsMap)[0] : null);

          if (!pin && reduxState?.resources?.PinResource) {
            const pinRes = reduxState.resources.PinResource;
            const firstKey = Object.keys(pinRes)[0];
            if (firstKey) pin = pinRes[firstKey]?.data;
          }

          if (!pin && reduxState?.resources?.CloseupPinResource) {
            const closeupRes = reduxState.resources.CloseupPinResource;
            const firstKey = Object.keys(closeupRes)[0];
            if (firstKey) pin = closeupRes[firstKey]?.data;
          }

          if (!pin && reduxState?.resources) {
            for (const [resName, resObj] of Object.entries(reduxState.resources) as [string, any][]) {
              if (resName.toLowerCase().includes('pin')) {
                const firstKey = Object.keys(resObj)[0];
                if (firstKey && resObj[firstKey]?.data?.id) {
                  pin = resObj[firstKey].data;
                  break;
                }
              }
            }
          }

          // If no annotations from v3GetPinQuery, try Redux state
          if (annotations.length === 0 && pin?.pin_join?.annotations_with_links) {
            const annotationsRaw = pin.pin_join.annotations_with_links;
            const annotationsArray = Array.isArray(annotationsRaw)
              ? annotationsRaw.flat()
              : Object.values(annotationsRaw);
            for (const item of annotationsArray as any[]) {
              if (item?.name) {
                annotations.push({
                  name: item.name,
                  url: item.url
                    ? (item.url.startsWith('http') ? item.url : `https://${domain}${item.url}`)
                    : '',
                });
              }
            }
          }
        }
      } catch {
        // Redux parse failed, continue with v3 data if available
      }
    }

    // If we have neither v3 data nor Redux pin data, fail
    if (!pin && !v3PinData) {
      const isChallenge = html.includes('challenge') || html.includes('login');
      if (isChallenge) {
        return { success: false, error: 'Pinterest verlangt Challenge/Login-Verifizierung' };
      }
      return { success: false, error: 'Keine Pin-Daten gefunden (weder v3GetPinQuery noch Redux-State)' };
    }

    // Use Redux pin as primary data source for structured fields, v3 data as supplement
    pin = pin || {};
    const now = new Date().toISOString();

    // Extract all image sizes
    const images: Record<string, { url: string; width: number; height: number }> = {};
    if (pin?.images) {
      for (const [size, data] of Object.entries(pin.images) as [string, any][]) {
        if (data?.url) {
          images[size] = { url: data.url, width: data.width || 0, height: data.height || 0 };
        }
      }
    }

    const imageUrl = images['736x']?.url || images['564x']?.url || images['474x']?.url || images['orig']?.url || null;
    const thumbnailUrl = images['236x']?.url || images['170x']?.url || images['136x136']?.url || null;

    // Extract article/rich pin link
    const articleUrl = pin?.rich_summary?.url
      || pin?.rich_metadata?.url
      || pin?.rich_metadata?.article?.url
      || pin?.link
      || pin?.attribution?.url
      || pin?.tracked_link
      || null;

    // Extract pin created date
    let pinCreatedAt = pin?.created_at || pin?.created_time || pin?.date_created || null;
    if (pinCreatedAt && typeof pinCreatedAt === 'number') {
      pinCreatedAt = pinCreatedAt < 4102444800
        ? new Date(pinCreatedAt * 1000).toISOString()
        : new Date(pinCreatedAt).toISOString();
    }

    // Extract board info
    const board = {
      id: pin?.board?.id || null,
      name: pin?.board?.name || pin?.board?.title || pin?.pin_join?.board?.name || null,
      url: pin?.board?.url ? `https://${domain}${pin.board.url}` : null,
      privacy: pin?.board?.privacy || null,
    };

    // Extract pinner/creator info
    const pinner = {
      id: pin?.pinner?.id || pin?.native_creator?.id || null,
      username: pin?.pinner?.username || pin?.native_creator?.username || null,
      full_name: pin?.pinner?.full_name || pin?.native_creator?.full_name || null,
      image_url: pin?.pinner?.image_medium_url || pin?.native_creator?.image_medium_url || null,
    };

    // Extract rich metadata
    let richMetadata: PinDetail['rich_metadata'] = null;
    if (pin?.rich_metadata) {
      richMetadata = {
        type: pin.rich_metadata.type || pin.rich_metadata.pin_type || null,
        title: pin.rich_metadata.title || null,
        description: pin.rich_metadata.description || null,
        url: pin.rich_metadata.url || null,
        site_name: pin.rich_metadata.site_name || null,
        favicon_url: pin.rich_metadata.favicon_link || pin.rich_metadata.favicon_url || null,
      };
    }

    // Comment count
    const commentCount = pin?.comment_count
      || pin?.aggregated_pin_data?.comment_count
      || pin?.aggregated_pin_data?.aggregated_stats?.comments
      || 0;

    const pinDetail: PinDetail = {
      id: pin?.id || pinId,
      title: pin?.title || pin?.grid_title || null,
      description: pin?.description || pin?.closeup_description || null,
      image_url: imageUrl,
      image_thumbnail_url: thumbnailUrl,
      images,
      link: `https://www.pinterest.com/pin/${pin?.id || pinId}/`,
      article_url: articleUrl,
      repin_count: pin?.repin_count || 0,
      save_count: pin?.aggregated_pin_data?.aggregated_stats?.saves || 0,
      comment_count: commentCount,
      annotations,
      pin_created_at: pinCreatedAt,
      domain: pin?.domain || null,
      board,
      pinner,
      is_video: !!(pin?.is_video || pin?.videos),
      is_promoted: !!(pin?.is_promoted || pin?.is_ad),
      tracking_params: pin?.tracking_params || null,
      rich_metadata: richMetadata,
      scraped_at: now,
      raw_data_keys: Object.keys(pin),
    };

    return { success: true, pin: pinDetail };
  } catch (error) {
    console.error('Pin scrape error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Pin-Scraping',
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
