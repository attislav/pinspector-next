import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID ist erforderlich' },
        { status: 400 }
      );
    }

    const idea = await queryOne<DbIdea>(
      'SELECT * FROM public.ideas WHERE id = $1',
      [id]
    );

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea nicht gefunden' },
        { status: 404 }
      );
    }

    // Transform to match expected format
    const result = {
      ...idea,
      last_update: idea.last_update?.toISOString() || null,
      last_scrape: idea.last_scrape?.toISOString() || null,
      related_interests: idea.related_interests ? JSON.parse(idea.related_interests) : [],
      seo_breadcrumbs: idea.seo_breadcrumbs ? JSON.parse(idea.seo_breadcrumbs) : [],
      klp_pivots: idea.klp_pivots ? JSON.parse(idea.klp_pivots) : [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
