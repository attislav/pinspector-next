import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { PaginatedResponse, Idea, FilteredIdea } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '30');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'last_scrape';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const minSearches = searchParams.get('minSearches');
    const maxSearches = searchParams.get('maxSearches');
    const minWords = searchParams.get('minWords');
    const maxWords = searchParams.get('maxWords');
    const mainCategory = searchParams.get('mainCategory');
    const subCategory = searchParams.get('subCategory');
    const language = searchParams.get('language');

    // Validate sortBy to prevent injection
    const validSortColumns = ['name', 'searches', 'last_scrape', 'last_update', 'search_diff'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'last_scrape';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const offset = (page - 1) * pageSize;

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_filtered_ideas', {
      p_search: search || null,
      p_min_searches: minSearches ? parseInt(minSearches) : null,
      p_max_searches: maxSearches ? parseInt(maxSearches) : null,
      p_min_words: minWords ? parseInt(minWords) : null,
      p_max_words: maxWords ? parseInt(maxWords) : null,
      p_main_category: mainCategory || null,
      p_sub_category: subCategory || null,
      p_sort_by: safeSortBy,
      p_sort_order: safeSortOrder,
      p_limit: pageSize,
      p_offset: offset,
      p_language: language || null,
    });

    if (error) throw error;

    const rows = (data || []) as FilteredIdea[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    // Remove total_count, keep history_count
    const ideas = rows.map(({ total_count: _, ...rest }) => rest);

    const response: PaginatedResponse<Idea & { history_count?: number; prev_searches?: number | null }> = {
      data: ideas,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs sind erforderlich' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Delete ideas (CASCADE handles idea_history and idea_pins)
    const { error } = await supabase
      .from('ideas')
      .delete()
      .in('id', ids);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
