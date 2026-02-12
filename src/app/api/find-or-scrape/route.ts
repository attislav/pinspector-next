import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { scrapePinterestIdea } from '@/lib/pinterest-scraper';

interface DbIdea {
  id: string;
  name: string;
  url: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { name, url } = await request.json();

    if (!name && !url) {
      return NextResponse.json(
        { success: false, error: 'Name oder URL erforderlich' },
        { status: 400 }
      );
    }

    // If URL is provided, scrape directly
    if (url) {
      const scrapeResult = await scrapePinterestIdea(url);
      if (scrapeResult.success && scrapeResult.idea) {
        return NextResponse.json({
          success: true,
          idea: scrapeResult.idea,
          source: 'scraped',
        });
      }
      return NextResponse.json({
        success: false,
        error: scrapeResult.error || 'Scraping fehlgeschlagen',
      });
    }

    // Search by name in database first (case-insensitive)
    const existingIdea = await queryOne<DbIdea>(
      `SELECT id, name, url FROM public.ideas
       WHERE LOWER(name) = LOWER($1)
       LIMIT 1`,
      [name]
    );

    if (existingIdea) {
      return NextResponse.json({
        success: true,
        idea: existingIdea,
        source: 'database',
      });
    }

    // Try partial match
    const partialMatch = await queryOne<DbIdea>(
      `SELECT id, name, url FROM public.ideas
       WHERE LOWER(name) LIKE LOWER($1)
       ORDER BY searches DESC
       LIMIT 1`,
      [`%${name}%`]
    );

    if (partialMatch) {
      return NextResponse.json({
        success: true,
        idea: partialMatch,
        source: 'database_partial',
      });
    }

    // Try to construct Pinterest Ideas URL and scrape
    // Pinterest URLs follow pattern: /ideas/{slug}/{id}/
    // Without an ID, we can't directly access the page
    // But we can try the German Pinterest site with the slug
    const slug = name.toLowerCase()
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Try common Pinterest URL patterns
    const urlsToTry = [
      `https://www.pinterest.de/ideas/${slug}/`,
      `https://www.pinterest.com/ideas/${slug}/`,
    ];

    for (const tryUrl of urlsToTry) {
      try {
        // Fetch the page to see if it redirects to a valid ID
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          redirect: 'follow',
        });

        const finalUrl = response.url;

        // Check if we got redirected to a valid ideas page with ID
        if (finalUrl.match(/\/ideas\/[^/]+\/\d+/)) {
          const scrapeResult = await scrapePinterestIdea(finalUrl);
          if (scrapeResult.success && scrapeResult.idea) {
            // Save to database
            await saveIdea(scrapeResult.idea);
            return NextResponse.json({
              success: true,
              idea: scrapeResult.idea,
              source: 'scraped_redirect',
            });
          }
        }
      } catch {
        // Try next URL
        continue;
      }
    }

    return NextResponse.json({
      success: false,
      error: `Interest "${name}" nicht gefunden`,
      searched: true,
    });
  } catch (error) {
    console.error('Find or scrape error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

async function saveIdea(idea: any) {
  try {
    const existingIdea = await queryOne<{ id: string }>(
      'SELECT id FROM public.ideas WHERE id = $1',
      [idea.id]
    );

    if (existingIdea) {
      await query(
        `UPDATE public.ideas SET
          name = $1, url = $2, searches = $3, last_update = $4, last_scrape = $5,
          related_interests = $6, top_annotations = $7, seo_breadcrumbs = $8, klp_pivots = $9
        WHERE id = $10`,
        [
          idea.name, idea.url, idea.searches, idea.last_update, new Date().toISOString(),
          JSON.stringify(idea.related_interests), idea.top_annotations,
          JSON.stringify(idea.seo_breadcrumbs), JSON.stringify(idea.klp_pivots || []),
          idea.id,
        ]
      );
    } else {
      await query(
        `INSERT INTO public.ideas (id, name, url, searches, last_update, last_scrape, related_interests, top_annotations, seo_breadcrumbs, klp_pivots)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          idea.id, idea.name, idea.url, idea.searches, idea.last_update, new Date().toISOString(),
          JSON.stringify(idea.related_interests), idea.top_annotations,
          JSON.stringify(idea.seo_breadcrumbs), JSON.stringify(idea.klp_pivots || []),
        ]
      );

      await query(
        `INSERT INTO public.idea_history (idea_id, name, searches, scrape_date)
         VALUES ($1, $2, $3, $4)`,
        [idea.id, idea.name, idea.searches, new Date().toISOString()]
      );
    }
  } catch (error) {
    console.error('Error saving idea:', error);
  }
}
