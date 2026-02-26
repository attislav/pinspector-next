import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { ids, names } = await request.json();

    const supabase = getSupabase();
    const foundIds: string[] = [];
    const foundNames: string[] = [];

    // Check by IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const uniqueIds = [...new Set(ids as string[])].slice(0, 500);
      const { data, error } = await supabase
        .from('ideas')
        .select('id')
        .in('id', uniqueIds);
      if (!error && data) {
        for (const row of data) foundIds.push(row.id);
      }
    }

    // Check by names (case-insensitive)
    if (names && Array.isArray(names) && names.length > 0) {
      const uniqueNames = [...new Set(names as string[])].slice(0, 500);
      const { data, error } = await supabase
        .from('ideas')
        .select('name');
      if (!error && data) {
        const nameSet = new Set(uniqueNames.map(n => n.toLowerCase()));
        for (const row of data) {
          if (nameSet.has(row.name.toLowerCase())) {
            foundNames.push(row.name);
          }
        }
      }
    }

    return NextResponse.json({ ids: foundIds, names: foundNames });
  } catch (error) {
    console.error('Check API error:', error);
    return NextResponse.json({ ids: [], names: [] });
  }
}
