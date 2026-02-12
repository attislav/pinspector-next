import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DbPin {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  link: string | null;
  article_url: string | null;
  repin_count: number;
  save_count: number;
  comment_count: number;
  annotations: string[] | null;
  pin_created_at: Date | null;
  last_scrape: Date | null;
  idea_ids: string[] | null;
  idea_names: string[] | null;
}

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

    // Build query with filters
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (ideaId) {
      conditions.push(`ip.idea_id = $${paramIndex}`);
      params.push(ideaId);
      paramIndex++;
    }

    if (minSaves) {
      conditions.push(`p.save_count >= $${paramIndex}`);
      params.push(parseInt(minSaves));
      paramIndex++;
    }

    if (maxSaves) {
      conditions.push(`p.save_count <= $${paramIndex}`);
      params.push(parseInt(maxSaves));
      paramIndex++;
    }

    if (hasArticle === 'true') {
      conditions.push(`p.article_url IS NOT NULL AND p.article_url != ''`);
    } else if (hasArticle === 'false') {
      conditions.push(`(p.article_url IS NULL OR p.article_url = '')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const validSortColumns = ['save_count', 'repin_count', 'comment_count', 'pin_created_at', 'title', 'last_scrape'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'save_count';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM public.pins p
      LEFT JOIN public.idea_pins ip ON p.id = ip.pin_id
      ${whereClause}
    `;
    const countResult = await query<{ total: string }>(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0');

    // Get pins with aggregated idea info
    const pinsQuery = `
      SELECT
        p.*,
        array_agg(DISTINCT ip.idea_id) FILTER (WHERE ip.idea_id IS NOT NULL) as idea_ids,
        array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL) as idea_names
      FROM public.pins p
      LEFT JOIN public.idea_pins ip ON p.id = ip.pin_id
      LEFT JOIN public.ideas i ON ip.idea_id = i.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${sortColumn} ${sortDir} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const pins = await query<DbPin>(pinsQuery, [...params, limit, offset]);

    // Transform results
    const transformedPins = pins.map(pin => ({
      ...pin,
      pin_created_at: pin.pin_created_at?.toISOString() || null,
      last_scrape: pin.last_scrape?.toISOString() || null,
      ideas: pin.idea_ids?.map((id, idx) => ({
        id,
        name: pin.idea_names?.[idx] || ''
      })) || []
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
