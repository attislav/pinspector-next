import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchGoogle } from '@/lib/search';
import { scrapePinterestIdea, isValidPinterestIdeasUrl, extractIdFromUrl } from '@/lib/pinterest-scraper';
import { saveIdeaToDb, savePinsToDb } from '@/lib/idea-persistence';

export const maxDuration = 120;

interface KeywordEntry {
  name: string;
  count: number;
  source: 'annotation' | 'klp_pivot' | 'related_interest';
}

interface ScrapedIdea {
  id: string;
  name: string;
  searches: number;
  fromTopic: string;
}

async function generateSubTopics(topic: string): Promise<string[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OpenAI API Key nicht konfiguriert');
  }

  const prompt = `Du bist ein Pinterest-Keyword-Experte. Zu dem Thema "${topic}" brauchst du eine umfassende Topical Map.

Generiere 10-15 Suchbegriffe, die ich auf Pinterest als "Ideas" finden würde. Denke dabei an:

1. Hauptvarianten des Themas (mit verschiedenen Attributen wie Stil, Material, Farbe, Saison)
2. Unterbereiche die nicht direkt im Wort stecken, aber thematisch wichtig sind
3. Verwandte Themen die jemand suchen würde, der sich für "${topic}" interessiert
4. Spezifische Ausprägungen (z.B. "DIY", "modern", "minimalistisch", "günstig")
5. Saisonale oder trendige Varianten

Regeln:
- Nur deutsche Begriffe
- Jeder Begriff auf einer eigenen Zeile
- Keine Nummerierung, keine Erklärungen
- Begriffe sollten so sein, wie Leute auf Pinterest suchen würden
- Mix aus breiten und spezifischen Begriffen`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error('OpenAI API Fehler: ' + (error.error?.message || 'Unbekannt'));
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return content
    .split('\n')
    .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim())
    .filter((line: string) => line.length > 2 && line.length < 80);
}

async function findPinterestUrlsForTopic(topic: string, limit: number): Promise<string[]> {
  const fullQuery = `site:de.pinterest.com/ideas ${topic}`;
  const results = await searchGoogle(fullQuery, limit * 2);

  const urls: string[] = [];
  for (const result of results) {
    if (result.url && result.url.includes('/ideas/') && isValidPinterestIdeasUrl(result.url) && !urls.includes(result.url)) {
      urls.push(result.url);
    }
    if (urls.length >= limit) break;
  }
  return urls;
}

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      urlsPerTopic = 5,
      scrapePerTopic = 3,
      deepScan = false,
      skipExisting = true,
    } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Thema ist erforderlich' },
        { status: 400 }
      );
    }

    // 1. Generate sub-topics via AI
    let subTopics: string[];
    try {
      subTopics = await generateSubTopics(topic);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KI-Fehler';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (subTopics.length === 0) {
      return NextResponse.json({
        success: true,
        topic,
        subTopics: [],
        scrapedIdeas: [],
        keywords: [],
      });
    }

    // 2. Search Pinterest Ideas for each sub-topic
    const allUrls = new Map<string, string>(); // url -> fromTopic
    const topicResults: { topic: string; urlsFound: number }[] = [];

    for (const subTopic of subTopics) {
      try {
        const urls = await findPinterestUrlsForTopic(subTopic, urlsPerTopic);
        let newCount = 0;
        for (const url of urls) {
          if (!allUrls.has(url)) {
            allUrls.set(url, subTopic);
            newCount++;
          }
        }
        topicResults.push({ topic: subTopic, urlsFound: newCount });
      } catch (error) {
        console.error(`Search error for "${subTopic}":`, error);
        topicResults.push({ topic: subTopic, urlsFound: 0 });
      }
    }

    // 3. Filter existing if requested
    let urlsToProcess = Array.from(allUrls.entries()); // [url, fromTopic][]

    if (skipExisting && urlsToProcess.length > 0) {
      const ids = urlsToProcess
        .map(([url]) => extractIdFromUrl(url))
        .filter(Boolean) as string[];

      if (ids.length > 0) {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const existing = await query<{ id: string }>(
          `SELECT id FROM public.ideas WHERE id IN (${placeholders})`,
          ids
        );
        const existingIds = new Set(existing.map(e => e.id));
        urlsToProcess = urlsToProcess.filter(([url]) => {
          const id = extractIdFromUrl(url);
          return !id || !existingIds.has(id);
        });
      }
    }

    // 4. Scrape URLs (limited per topic)
    const scrapeCount = Math.min(urlsToProcess.length, subTopics.length * scrapePerTopic);
    const urlsToScrape = urlsToProcess.slice(0, scrapeCount);

    const scrapedIdeas: ScrapedIdea[] = [];
    const keywordMap = new Map<string, { count: number; source: KeywordEntry['source'] }>();

    for (let i = 0; i < urlsToScrape.length; i++) {
      const [url, fromTopic] = urlsToScrape[i];

      try {
        const result = await scrapePinterestIdea(url);

        if (result.success && result.idea) {
          const idea = result.idea;
          const pins = result.pins || [];

          await saveIdeaToDb(idea);
          await savePinsToDb(idea.id, pins);

          scrapedIdeas.push({
            id: idea.id,
            name: idea.name,
            searches: idea.searches,
            fromTopic,
          });

          // 5. Collect keywords if deepScan enabled
          if (deepScan) {
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
        }
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }

      // Rate limiting
      if (i < urlsToScrape.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 6. Sort keywords
    const keywords: KeywordEntry[] = Array.from(keywordMap.entries())
      .map(([name, data]) => ({ name, count: data.count, source: data.source }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      topic,
      subTopics: topicResults,
      totalUrlsFound: allUrls.size,
      urlsScraped: scrapedIdeas.length,
      scrapedIdeas,
      keywords,
    });
  } catch (error) {
    console.error('Discover topics error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
