import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from('ideas')
      .select('seo_breadcrumbs')
      .not('seo_breadcrumbs', 'is', null);

    if (error) throw error;

    // Extract unique categories at each level
    const mainCategories = new Set<string>();
    const subCategories = new Map<string, Set<string>>();

    for (const row of rows || []) {
      if (!row.seo_breadcrumbs) continue;

      const breadcrumbs = row.seo_breadcrumbs as unknown[];
      if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) continue;

      // Get main category (first element)
      const mainCat = typeof breadcrumbs[0] === 'string'
        ? breadcrumbs[0]
        : (breadcrumbs[0] as { name?: string })?.name;

      if (mainCat) {
        mainCategories.add(mainCat);

        // Get sub category (second element) if exists AND there are more than 2 breadcrumbs
        if (breadcrumbs.length > 2) {
          const subCat = typeof breadcrumbs[1] === 'string'
            ? breadcrumbs[1]
            : (breadcrumbs[1] as { name?: string })?.name;

          if (subCat) {
            if (!subCategories.has(mainCat)) {
              subCategories.set(mainCat, new Set());
            }
            subCategories.get(mainCat)!.add(subCat);
          }
        }
      }
    }

    // Convert to sorted arrays
    const mainCatArray = Array.from(mainCategories).sort((a, b) => a.localeCompare(b, 'de'));
    const subCatObject: Record<string, string[]> = {};

    for (const [main, subs] of subCategories) {
      subCatObject[main] = Array.from(subs).sort((a, b) => a.localeCompare(b, 'de'));
    }

    return NextResponse.json({
      mainCategories: mainCatArray,
      subCategories: subCatObject,
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
