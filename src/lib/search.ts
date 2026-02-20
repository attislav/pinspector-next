/**
 * DataForSEO SERP API - reliable Google search results.
 * Uses the Live Advanced endpoint for instant results.
 *
 * Requires DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env.local
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  breadcrumb: string | null;
}

export interface SearchOptions {
  locationCode?: number;
  languageCode?: string;
}

export async function searchGoogle(query: string, maxResults: number = 20, options?: SearchOptions): Promise<SearchResult[]> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error('DataForSEO Zugangsdaten fehlen (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)');
  }

  const auth = Buffer.from(`${login}:${password}`).toString('base64');

  // depth must be multiple of 10, minimum 10
  // Use higher depth to ensure we get enough results (site: queries often have few organic results)
  const depth = Math.max(30, Math.ceil(maxResults / 10) * 10);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword: query,
          location_code: options?.locationCode ?? 2276,
          language_code: options?.languageCode ?? 'de',
          device: 'desktop',
          depth,
        },
      ]),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('DataForSEO Authentifizierung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
      }
      throw new Error(`DataForSEO HTTP ${response.status}`);
    }

    const data = await response.json();

    const task = data?.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      const errorMsg = task?.status_message || 'Unbekannter DataForSEO-Fehler';
      throw new Error(`DataForSEO: ${errorMsg}`);
    }

    const items = task.result?.[0]?.items || [];
    const results: SearchResult[] = [];

    for (const item of items) {
      if (item.type === 'organic' && item.url) {
        results.push({
          title: item.title || '',
          url: item.url,
          snippet: item.description || '',
          breadcrumb: item.breadcrumb || null,
        });
      }
      if (results.length >= maxResults) break;
    }

    return results;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('DataForSEO Zeitüberschreitung (20s)');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
