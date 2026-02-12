/**
 * DuckDuckGo HTML search - no API key, no VQD token needed.
 * Uses the static HTML endpoint which is more reliable than the JS API.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

export interface DdgResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchDuckDuckGo(query: string, maxResults: number = 20): Promise<DdgResult[]> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      body: `q=${encodeURIComponent(query)}&b=&kl=de-de`,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('DuckDuckGo Rate-Limit erreicht. Bitte warte einen Moment und versuche es erneut.');
      }
      throw new Error(`DuckDuckGo HTTP ${response.status}`);
    }

    const html = await response.text();
    return parseResults(html, maxResults);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('DuckDuckGo Zeitüberschreitung (15s)');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseResults(html: string, maxResults: number): DdgResult[] {
  const results: DdgResult[] = [];

  // DuckDuckGo HTML results are in <div class="result ..."> blocks
  // Each result has:
  //   <a class="result__a" href="...">title</a>
  //   <a class="result__url" href="...">url display</a>
  //   <a class="result__snippet">snippet</a>

  // Match result blocks - each contains a link with class "result__a"
  const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const links: { url: string; title: string }[] = [];
  let match;

  while ((match = resultRegex.exec(html)) !== null) {
    // DuckDuckGo wraps URLs in a redirect: //duckduckgo.com/l/?uddg=ENCODED_URL&...
    let url = match[1];
    const title = stripHtml(match[2]).trim();

    // Decode the redirect URL
    const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    if (url && title) {
      links.push({ url, title });
    }
  }

  // Collect snippets
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]).trim());
  }

  for (let i = 0; i < links.length && results.length < maxResults; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ');
}
