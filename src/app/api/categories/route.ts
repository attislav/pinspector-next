import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface CategoryRow {
  seo_breadcrumbs: string | null;
}

export async function GET() {
  try {
    // Get all seo_breadcrumbs from ideas
    const rows = await query<CategoryRow>(
      'SELECT seo_breadcrumbs FROM public.ideas WHERE seo_breadcrumbs IS NOT NULL'
    );

    // Extract unique categories at each level
    const mainCategories = new Set<string>();
    const subCategories = new Map<string, Set<string>>();

    for (const row of rows) {
      if (!row.seo_breadcrumbs) continue;

      try {
        const breadcrumbs = JSON.parse(row.seo_breadcrumbs);
        if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) continue;

        // The last breadcrumb is often the interest itself, so we exclude it
        // We only use the first 2 breadcrumbs as categories:
        // [0] = Main category (e.g., "Dekoideen Für Die Wohnung")
        // [1] = Sub category (e.g., "Einrichtungsstil")
        // [2+] = Usually the interest itself, ignore

        // Get main category (first element)
        const mainCat = typeof breadcrumbs[0] === 'string'
          ? breadcrumbs[0]
          : breadcrumbs[0]?.name;

        if (mainCat) {
          mainCategories.add(mainCat);

          // Get sub category (second element) if exists AND there are more than 2 breadcrumbs
          // If there are exactly 2, the second one is likely the interest itself
          if (breadcrumbs.length > 2) {
            const subCat = typeof breadcrumbs[1] === 'string'
              ? breadcrumbs[1]
              : breadcrumbs[1]?.name;

            if (subCat) {
              if (!subCategories.has(mainCat)) {
                subCategories.set(mainCat, new Set());
              }
              subCategories.get(mainCat)!.add(subCat);
            }
          }
        }
      } catch {
        // Skip invalid JSON
        continue;
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
