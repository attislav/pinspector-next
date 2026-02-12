import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { PaginatedResponse, Idea } from '@/types/database';

interface DbIdea {
  id: string;
  name: string;
  url: string | null;
  searches: number;
  last_update: Date | null;
  last_scrape: Date | null;
  related_interests: string | null;
  top_annotations: string | null;
  seo_breadcrumbs: string | null;
  klp_pivots: string | null;
}

function mapDbIdea(row: DbIdea): Idea {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    searches: row.searches || 0,
    last_update: row.last_update?.toISOString() || null,
    last_scrape: row.last_scrape?.toISOString() || new Date().toISOString(),
    related_interests: row.related_interests ? JSON.parse(row.related_interests) : [],
    top_annotations: row.top_annotations,
    seo_breadcrumbs: row.seo_breadcrumbs ? JSON.parse(row.seo_breadcrumbs) : [],
    klp_pivots: row.klp_pivots ? JSON.parse(row.klp_pivots) : [],
    created_at: row.last_scrape?.toISOString() || new Date().toISOString(),
  };
}

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

    // Build query
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (minSearches) {
      conditions.push(`searches >= $${paramIndex}`);
      params.push(parseInt(minSearches));
      paramIndex++;
    }

    if (maxSearches) {
      conditions.push(`searches <= $${paramIndex}`);
      params.push(parseInt(maxSearches));
      paramIndex++;
    }

    // Filter by word count (count spaces + 1 for words)
    if (minWords) {
      conditions.push(`(array_length(string_to_array(name, ' '), 1)) >= $${paramIndex}`);
      params.push(parseInt(minWords));
      paramIndex++;
    }

    if (maxWords) {
      conditions.push(`(array_length(string_to_array(name, ' '), 1)) <= $${paramIndex}`);
      params.push(parseInt(maxWords));
      paramIndex++;
    }

    // Filter by main category (first element in seo_breadcrumbs JSON array)
    if (mainCategory) {
      conditions.push(`(
        seo_breadcrumbs IS NOT NULL AND (
          seo_breadcrumbs::jsonb->0->>'name' = $${paramIndex} OR
          seo_breadcrumbs::jsonb->>0 = $${paramIndex}
        )
      )`);
      params.push(mainCategory);
      paramIndex++;
    }

    // Filter by sub category (second element in seo_breadcrumbs JSON array)
    if (subCategory) {
      conditions.push(`(
        seo_breadcrumbs IS NOT NULL AND (
          seo_breadcrumbs::jsonb->1->>'name' = $${paramIndex} OR
          seo_breadcrumbs::jsonb->>1 = $${paramIndex}
        )
      )`);
      params.push(subCategory);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sortBy to prevent SQL injection
    const validSortColumns = ['name', 'searches', 'last_scrape', 'last_update'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'last_scrape';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM public.ideas ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0');

    // Get paginated data
    const offset = (page - 1) * pageSize;
    const dataParams = [...params, pageSize, offset];

    const data = await query<DbIdea>(
      `SELECT * FROM public.ideas ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder} NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    const response: PaginatedResponse<Idea> = {
      data: data.map(mapDbIdea),
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

    // Create placeholders for parameterized query
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

    // Delete history entries first (foreign key constraint)
    await query(
      `DELETE FROM public.idea_history WHERE idea_id IN (${placeholders})`,
      ids
    );

    // Delete ideas
    await query(
      `DELETE FROM public.ideas WHERE id IN (${placeholders})`,
      ids
    );

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
