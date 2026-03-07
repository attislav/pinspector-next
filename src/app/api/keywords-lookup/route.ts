import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords array is required' }, { status: 400 });
    }

    const normalized = keywords.map((k: string) => k.trim().toLowerCase());

    const supabase = getSupabase();

    // Pinterest interest names are lowercase, so direct match works
    const { data: results, error } = await supabase
      .from('ideas')
      .select('id, name, searches')
      .in('name', normalized)
      .order('searches', { ascending: false });

    if (error) throw error;

    // Build map: lowercase keyword -> { id, name, searches }
    const volumeMap: Record<string, { id: string; name: string; searches: number }> = {};
    for (const row of results || []) {
      const key = row.name.toLowerCase();
      if (!volumeMap[key] || row.searches > volumeMap[key].searches) {
        volumeMap[key] = { id: row.id, name: row.name, searches: row.searches || 0 };
      }
    }

    return NextResponse.json({ results: volumeMap });
  } catch (error) {
    console.error('Keywords lookup error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
