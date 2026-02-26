import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { ids, names } = await request.json();

    const supabase = getSupabase();
    const foundIds: string[] = [];
    const foundNames: string[] = [];

    // Check by IDs (direct lookup, fast)
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

    // Check by names — use lowercased ILIKE queries in batches
    if (names && Array.isArray(names) && names.length > 0) {
      const uniqueNames = [...new Set((names as string[]).map(n => n.toLowerCase()))].slice(0, 500);

      // Query in batches of 50 using OR filters
      const batchSize = 50;
      for (let i = 0; i < uniqueNames.length; i += batchSize) {
        const batch = uniqueNames.slice(i, i + batchSize);

        // Use .or() with ilike filters
        const orFilter = batch.map(n => `name.ilike.${n}`).join(',');
        const { data, error } = await supabase
          .from('ideas')
          .select('name')
          .or(orFilter);

        if (!error && data) {
          const dbNameSet = new Set(data.map(row => row.name.toLowerCase()));
          for (const name of batch) {
            if (dbNameSet.has(name)) {
              foundNames.push(name);
            }
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
