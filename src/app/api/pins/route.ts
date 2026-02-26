import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { PinWithIdeas } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const ideaId = searchParams.get('ideaId') || '';
    const minSaves = searchParams.get('minSaves') || '';
    const maxSaves = searchParams.get('maxSaves') || '';
    const hasArticle = searchParams.get('hasArticle') || '';
    const sortBy = searchParams.get('sortBy') || 'save_count';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Validate sort column
    const validSortColumns = ['save_count', 'repin_count', 'comment_count', 'pin_created_at', 'title', 'last_scrape'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'save_count';
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_pins_with_ideas', {
      p_search: search || null,
      p_idea_id: ideaId || null,
      p_min_saves: minSaves ? parseInt(minSaves) : null,
      p_max_saves: maxSaves ? parseInt(maxSaves) : null,
      p_has_article: hasArticle || null,
      p_sort_column: sortColumn,
      p_sort_dir: sortDir,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    const pins = (data || []) as PinWithIdeas[];
    const total = pins.length > 0 ? Number(pins[0].total_count) : 0;

    // Transform results
    const transformedPins = pins.map(({ total_count: _, idea_ids, idea_names, ...pin }) => ({
      ...pin,
      ideas: (idea_ids || []).map((id: string, idx: number) => ({
        id,
        name: (idea_names || [])[idx] || ''
      }))
    }));

    return NextResponse.json({
      pins: transformedPins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Pins API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
