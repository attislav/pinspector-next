import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { scrapePinterestIdea, extractIdFromUrl } from '@/lib/pinterest-scraper';
import { Pin } from '@/types/database';

interface DbIdea {
  id: string;
  searches: number;
  last_update: Date | null;
  last_scrape: Date | null;
}

async function savePins(ideaId: string, pins: Pin[]) {
  if (!pins || pins.length === 0) return;

  // Delete existing idea_pins relationships for this idea
  await query('DELETE FROM public.idea_pins WHERE idea_id = $1', [ideaId]);

  // Collect all unique annotations from all pins to find matching interests
  const allAnnotations = new Set<string>();
  for (const pin of pins) {
    if (pin.annotations) {
      for (const annotation of pin.annotations) {
        allAnnotations.add(annotation.toLowerCase());
      }
    }
  }

  // Find all existing interests that match annotations (case-insensitive)
  let matchingInterests: { id: string; name: string }[] = [];
  if (allAnnotations.size > 0) {
    const annotationArray = Array.from(allAnnotations);
    const placeholders = annotationArray.map((_, i) => `$${i + 1}`).join(', ');
    matchingInterests = await query<{ id: string; name: string }>(
      `SELECT id, LOWER(name) as name FROM public.ideas WHERE LOWER(name) IN (${placeholders})`,
      annotationArray
    );
  }

  // Create a map for quick lookup: lowercase name -> idea id
  const interestMap = new Map<string, string>();
  for (const interest of matchingInterests) {
    interestMap.set(interest.name, interest.id);
  }

  // Upsert pins and create relationships
  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];

    // Upsert pin (insert or update if exists)
    await query(
      `INSERT INTO public.pins (id, title, description, image_url, image_thumbnail_url, link, article_url, repin_count, save_count, comment_count, annotations, pin_created_at, domain, last_scrape)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         image_url = EXCLUDED.image_url,
         image_thumbnail_url = EXCLUDED.image_thumbnail_url,
         link = EXCLUDED.link,
         article_url = EXCLUDED.article_url,
         repin_count = EXCLUDED.repin_count,
         save_count = EXCLUDED.save_count,
         comment_count = EXCLUDED.comment_count,
         annotations = EXCLUDED.annotations,
         pin_created_at = EXCLUDED.pin_created_at,
         domain = EXCLUDED.domain,
         last_scrape = NOW()`,
      [
        pin.id,
        pin.title,
        pin.description,
        pin.image_url,
        pin.image_thumbnail_url,
        pin.link,
        pin.article_url,
        pin.repin_count || 0,
        pin.save_count || 0,
        pin.comment_count || 0,
        pin.annotations || [],
        pin.pin_created_at,
        pin.domain,
      ]
    );

    // Create idea_pins relationship with position for the current idea
    await query(
      `INSERT INTO public.idea_pins (idea_id, pin_id, position) VALUES ($1, $2, $3)
       ON CONFLICT (idea_id, pin_id) DO UPDATE SET position = EXCLUDED.position`,
      [ideaId, pin.id, i]
    );

    // Also create relationships for matching annotations
    if (pin.annotations) {
      for (const annotation of pin.annotations) {
        const matchingIdeaId = interestMap.get(annotation.toLowerCase());
        if (matchingIdeaId && matchingIdeaId !== ideaId) {
          // Link pin to the matching interest (position -1 means linked via annotation)
          await query(
            `INSERT INTO public.idea_pins (idea_id, pin_id, position) VALUES ($1, $2, -1)
             ON CONFLICT (idea_id, pin_id) DO NOTHING`,
            [matchingIdeaId, pin.id]
          );
        }
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, skipIfRecent } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL ist erforderlich' },
        { status: 400 }
      );
    }

    // If skipIfRecent is true, first check if we already have this idea with recent scrape
    if (skipIfRecent) {
      const idFromUrl = extractIdFromUrl(url);
      if (idFromUrl) {
        const existingIdea = await queryOne<DbIdea>(
          'SELECT * FROM public.ideas WHERE id = $1',
          [idFromUrl]
        );

        if (existingIdea) {
          // Check if scraped within the last hour
          const lastScrape = existingIdea.last_scrape ? new Date(existingIdea.last_scrape) : new Date(0);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

          if (lastScrape > oneHourAgo) {
            // Return existing data without re-scraping
            return NextResponse.json({
              success: true,
              idea: existingIdea,
              isNew: false,
              isDuplicate: true,
              skippedScrape: true,
            });
          }
        }
      }
    }

    // Scrape the Pinterest page
    const scrapeResult = await scrapePinterestIdea(url);

    if (!scrapeResult.success || !scrapeResult.idea) {
      return NextResponse.json(scrapeResult, { status: 400 });
    }

    const idea = scrapeResult.idea;
    const pins = scrapeResult.pins || [];

    // Check if idea already exists
    const existingIdea = await queryOne<DbIdea>(
      'SELECT id, searches, last_update FROM public.ideas WHERE id = $1',
      [idea.id]
    );

    let isNew = false;
    let isDuplicate = false;

    if (existingIdea) {
      isDuplicate = true;

      // Update existing idea
      await query(
        `UPDATE public.ideas SET
          name = $1,
          url = $2,
          searches = $3,
          last_update = $4,
          last_scrape = $5,
          related_interests = $6,
          top_annotations = $7,
          seo_breadcrumbs = $8,
          klp_pivots = $9
        WHERE id = $10`,
        [
          idea.name,
          idea.url,
          idea.searches,
          idea.last_update,
          new Date().toISOString(),
          JSON.stringify(idea.related_interests),
          idea.top_annotations,
          JSON.stringify(idea.seo_breadcrumbs),
          JSON.stringify(idea.klp_pivots),
          idea.id,
        ]
      );

      // Add history entry if searches changed
      if (existingIdea.searches !== idea.searches) {
        await query(
          `INSERT INTO public.idea_history (idea_id, name, searches, scrape_date)
           VALUES ($1, $2, $3, $4)`,
          [idea.id, idea.name, idea.searches, new Date().toISOString()]
        );
      }
    } else {
      isNew = true;

      // Insert new idea
      await query(
        `INSERT INTO public.ideas (id, name, url, searches, last_update, last_scrape, related_interests, top_annotations, seo_breadcrumbs, klp_pivots)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          idea.id,
          idea.name,
          idea.url,
          idea.searches,
          idea.last_update,
          new Date().toISOString(),
          JSON.stringify(idea.related_interests),
          idea.top_annotations,
          JSON.stringify(idea.seo_breadcrumbs),
          JSON.stringify(idea.klp_pivots),
        ]
      );

      // Add initial history entry
      await query(
        `INSERT INTO public.idea_history (idea_id, name, searches, scrape_date)
         VALUES ($1, $2, $3, $4)`,
        [idea.id, idea.name, idea.searches, new Date().toISOString()]
      );
    }

    // Save pins to database
    await savePins(idea.id, pins);

    return NextResponse.json({
      success: true,
      idea,
      pins,
      isNew,
      isDuplicate,
    });
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
