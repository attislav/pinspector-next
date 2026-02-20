import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchGoogle } from '@/lib/search';
import { scrapePinterestIdea, isValidPinterestIdeasUrl, extractIdFromUrl } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';
import { getLanguageConfig } from '@/lib/language-config';

export const maxDuration = 60;

interface KeywordEntry {
  name: string;
  count: number;
  source: 'annotation' | 'klp_pivot' | 'related_interest';
}

interface ScrapedIdea {
  id: string;
  name: string;
  searches: number;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, limit = 10, scrapeLimit = 5, skipExisting = true, language } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword ist erforderlich' },
        { status: 400 }
      );
    }

    // 1. Search for Pinterest Ideas URLs
    const langConfig = getLanguageConfig(language);
    let urls: string[] = [];
    const seenUrls = new Set<string>();

    const collectUrls = (results: { url: string }[]) => {
      for (const result of results) {
        const url = result.url;
        if (url && url.includes('/ideas/') && isValidPinterestIdeasUrl(url) && !seenUrls.has(url)) {
          seenUrls.add(url);
          urls.push(url);
        }
        if (urls.length >= limit) break;
      }
    };

    try {
      // Narrow search with locale-specific filter
      const narrowQuery = `${langConfig.siteFilter} ${keyword}`;
      const narrowResults = await searchGoogle(narrowQuery, limit * 3, {
        locationCode: langConfig.locationCode,
        languageCode: langConfig.languageCode,
      });
      collectUrls(narrowResults);

      // Broader fallback if not enough results
      if (urls.length < limit) {
        const broadQuery = `${langConfig.siteFilterBroad} ${keyword}`;
        const broadResults = await searchGoogle(broadQuery, limit * 3, {
          locationCode: langConfig.locationCode,
          languageCode: langConfig.languageCode,
        });
        collectUrls(broadResults);
      }
    } catch (searchError) {
      console.error('Search error:', searchError);
      const message = searchError instanceof Error ? searchError.message : 'Suchfehler';
      if (message.includes('Rate-Limit') || message.includes('429')) {
        return NextResponse.json(
          { error: message },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const urlsFound = urls.length;

    if (urlsFound === 0) {
      return NextResponse.json({
        success: true,
        keyword,
        urlsFound: 0,
        urlsScraped: 0,
        keywords: [],
        scrapedIdeas: [],
      });
    }

    // 2. Filter already existing URLs (optional)
    if (skipExisting && urls.length > 0) {
      const ids = urls.map(u => extractIdFromUrl(u)).filter(Boolean) as string[];
      if (ids.length > 0) {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const existing = await query<{ id: string }>(
          `SELECT id FROM public.ideas WHERE id IN (${placeholders})`,
          ids
        );
        const existingIds = new Set(existing.map(e => e.id));
        urls = urls.filter(u => {
          const id = extractIdFromUrl(u);
          return !id || !existingIds.has(id);
        });
      }
    }

    // 3. Scrape URLs (with delay, limited)
    const urlsToScrape = urls.slice(0, scrapeLimit);
    const keywordMap = new Map<string, { count: number; source: KeywordEntry['source'] }>();
    const scrapedIdeas: ScrapedIdea[] = [];

    for (let i = 0; i < urlsToScrape.length; i++) {
      const url = urlsToScrape[i];

      try {
        const result = await scrapePinterestIdea(url, {
          acceptLanguage: langConfig.acceptLanguage,
          pinterestDomain: langConfig.pinterestDomain,
          language: langConfig.languageCode,
        });

        if (result.success && result.idea) {
          const idea = result.idea;
          const pins = result.pins || [];

          // Save to DB
          await saveIdeaToDb(idea);
          await savePinsToDb(idea.id, pins);

          scrapedIdeas.push({
            id: idea.id,
            name: idea.name,
            searches: idea.searches,
          });

          // 4. Collect keywords from all sources

          // Annotations
          if (idea.top_annotations) {
            const regex = /<a[^>]*>([^<]*)<\/a>/g;
            let match;
            while ((match = regex.exec(idea.top_annotations)) !== null) {
              const name = match[1].toLowerCase();
              const existing = keywordMap.get(name);
              if (existing) {
                existing.count++;
              } else {
                keywordMap.set(name, { count: 1, source: 'annotation' });
              }
            }
          }

          // KLP Pivots
          if (idea.klp_pivots) {
            for (const pivot of idea.klp_pivots) {
              const name = pivot.name.toLowerCase();
              const existing = keywordMap.get(name);
              if (existing) {
                existing.count++;
              } else {
                keywordMap.set(name, { count: 1, source: 'klp_pivot' });
              }
            }
          }

          // Related Interests
          if (idea.related_interests) {
            for (const interest of idea.related_interests) {
              const name = interest.name.toLowerCase();
              const existing = keywordMap.get(name);
              if (existing) {
                existing.count++;
              } else {
                keywordMap.set(name, { count: 1, source: 'related_interest' });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }

      // Rate limiting delay (2s between requests)
      if (i < urlsToScrape.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 5. Deduplicate and sort by frequency
    const keywords: KeywordEntry[] = Array.from(keywordMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        source: data.source,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      keyword,
      urlsFound,
      urlsScraped: scrapedIdeas.length,
      keywords,
      scrapedIdeas,
    });
  } catch (error) {
    console.error('Discover keywords error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: `Discover-Fehler: ${message}` },
      { status: 500 }
    );
  }
}
