import { getSupabase } from '@/lib/db';
import { Idea, Pin } from '@/types/database';

/**
 * Upsert an idea into the database. Returns { isNew, isDuplicate }.
 */
export async function saveIdeaToDb(idea: Idea): Promise<{ isNew: boolean; isDuplicate: boolean }> {
  const supabase = getSupabase();

  // Check if exists
  const { data: existing } = await supabase
    .from('ideas')
    .select('id, searches, last_update')
    .eq('id', idea.id)
    .single();

  if (existing) {
    // Update existing idea
    const updateData: Record<string, unknown> = {
      name: idea.name,
      url: idea.url,
      searches: idea.searches,
      last_update: idea.last_update,
      last_scrape: new Date().toISOString(),
      related_interests: idea.related_interests,
      top_annotations: idea.top_annotations,
      annotation_url_map: idea.annotation_url_map,
      seo_breadcrumbs: idea.seo_breadcrumbs,
      klp_pivots: idea.klp_pivots,
    };

    // Always update language when scraper detected one (self-healing)
    if (idea.language) {
      updateData.language = idea.language;
    }

    const { error } = await supabase
      .from('ideas')
      .update(updateData)
      .eq('id', idea.id);

    if (error) throw error;

    // Add history entry if searches changed
    if ((existing as { searches: number }).searches !== idea.searches) {
      await saveIdeaHistory(idea.id, idea.name, idea.searches);
    }

    return { isNew: false, isDuplicate: true };
  }

  // Insert new idea
  const { error } = await supabase.from('ideas').insert({
    id: idea.id,
    name: idea.name,
    url: idea.url,
    searches: idea.searches,
    last_update: idea.last_update,
    last_scrape: new Date().toISOString(),
    related_interests: idea.related_interests,
    top_annotations: idea.top_annotations,
    annotation_url_map: idea.annotation_url_map,
    seo_breadcrumbs: idea.seo_breadcrumbs,
    klp_pivots: idea.klp_pivots,
    language: idea.language,
  });

  if (error) throw error;

  // Add initial history entry
  await saveIdeaHistory(idea.id, idea.name, idea.searches);

  return { isNew: true, isDuplicate: false };
}

/**
 * Save pins to the database and create idea_pins relationships.
 * Uses a database function for atomic transaction (all or nothing).
 */
export async function savePinsToDb(ideaId: string, pins: Pin[]): Promise<void> {
  if (!pins || pins.length === 0) return;

  const supabase = getSupabase();

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
    const { data } = await supabase
      .from('ideas')
      .select('id, name');

    if (data) {
      const annotationSet = allAnnotations;
      matchingInterests = (data as { id: string; name: string }[]).filter(row =>
        annotationSet.has(row.name.toLowerCase())
      );
    }
  }

  // Call the database function for atomic transaction
  const { error } = await supabase.rpc('save_pins_for_idea', {
    p_idea_id: ideaId,
    p_pins: pins,
    p_matching_interests: matchingInterests,
  });

  if (error) throw error;
}

/**
 * Save a history entry for an idea.
 */
export async function saveIdeaHistory(ideaId: string, name: string, searches: number): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from('idea_history').insert({
    idea_id: ideaId,
    name,
    searches,
    scrape_date: new Date().toISOString(),
  });

  if (error) throw error;
}
