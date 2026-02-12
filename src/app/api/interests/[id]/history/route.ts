import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DbHistory {
  id: number;
  idea_id: string;
  name: string;
  searches: number;
  scrape_date: Date | null;
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

    // Get only one entry per month (the last one of each month)
    const history = await query<DbHistory>(
      `SELECT DISTINCT ON (date_trunc('month', scrape_date))
         id, idea_id, name, searches, scrape_date
       FROM public.idea_history
       WHERE idea_id = $1
       ORDER BY date_trunc('month', scrape_date) ASC, scrape_date DESC`,
      [id]
    );

    // Transform dates to ISO strings
    const result = history.map(h => ({
      ...h,
      scrape_date: h.scrape_date?.toISOString() || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
