import { query, queryOne, withTransaction } from '@/lib/db';
import { Idea, Pin } from '@/types/database';

interface DbIdea {
  id: string;
  searches: number;
  last_update: Date | null;
  last_scrape: Date | null;
}

/**
 * Upsert an idea into the database. Returns { isNew, isDuplicate }.
 */
export async function saveIdeaToDb(idea: Idea): Promise<{ isNew: boolean; isDuplicate: boolean }> {
  const existingIdea = await queryOne<DbIdea>(
    'SELECT id, searches, last_update FROM public.ideas WHERE id = $1',
    [idea.id]
  );

  if (existingIdea) {
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
        klp_pivots = $9,
        language = COALESCE($10, language)
      WHERE id = $11`,
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
        idea.language,
        idea.id,
      ]
    );

    // Add history entry if searches changed
    if (existingIdea.searches !== idea.searches) {
      await saveIdeaHistory(idea.id, idea.name, idea.searches);
    }

    return { isNew: false, isDuplicate: true };
  }

  // Insert new idea
  await query(
    `INSERT INTO public.ideas (id, name, url, searches, last_update, last_scrape, related_interests, top_annotations, seo_breadcrumbs, klp_pivots, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
      idea.language,
    ]
  );

  // Add initial history entry
  await saveIdeaHistory(idea.id, idea.name, idea.searches);

  return { isNew: true, isDuplicate: false };
}

/**
 * Save pins to the database and create idea_pins relationships.
 * Uses a transaction so DELETE + INSERT is atomic (all or nothing).
 */
export async function savePinsToDb(ideaId: string, pins: Pin[]): Promise<void> {
  if (!pins || pins.length === 0) return;

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

  // Run DELETE + all INSERTs in a transaction: if anything fails, everything rolls back
  await withTransaction(async (client) => {
    // Delete existing idea_pins relationships for this idea
    await client.query('DELETE FROM public.idea_pins WHERE idea_id = $1', [ideaId]);

    // Upsert pins and create relationships
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];

      // Upsert pin (insert or update if exists)
      await client.query(
        `INSERT INTO public.pins (id, title, description, image_url, image_thumbnail_url, link, article_url, repin_count, save_count, comment_count, annotations, pin_created_at, domain, board_name, last_scrape)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
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
           board_name = EXCLUDED.board_name,
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
          pin.board_name,
        ]
      );

      // Create idea_pins relationship with position for the current idea
      await client.query(
        `INSERT INTO public.idea_pins (idea_id, pin_id, position) VALUES ($1, $2, $3)
         ON CONFLICT (idea_id, pin_id) DO UPDATE SET position = EXCLUDED.position`,
        [ideaId, pin.id, i]
      );

      // Also create relationships for matching annotations
      if (pin.annotations) {
        for (const annotation of pin.annotations) {
          const matchingIdeaId = interestMap.get(annotation.toLowerCase());
          if (matchingIdeaId && matchingIdeaId !== ideaId) {
            await client.query(
              `INSERT INTO public.idea_pins (idea_id, pin_id, position) VALUES ($1, $2, -1)
               ON CONFLICT (idea_id, pin_id) DO NOTHING`,
              [matchingIdeaId, pin.id]
            );
          }
        }
      }
    }
  });
}

/**
 * Save a history entry for an idea.
 */
export async function saveIdeaHistory(ideaId: string, name: string, searches: number): Promise<void> {
  await query(
    `INSERT INTO public.idea_history (idea_id, name, searches, scrape_date)
     VALUES ($1, $2, $3, $4)`,
    [ideaId, name, searches, new Date().toISOString()]
  );
}
