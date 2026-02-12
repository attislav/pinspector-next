import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface DbIdea {
  id: string;
  name: string;
  url: string | null;
  searches: number;
  related_interests: string | null;
  top_annotations: string | null;
}

// German umlaut replacements for CSV
function fixUmlauts(text: string): string {
  return text
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Ã/g, 'Ü')
    .replace(/GroÃ/g, 'Groß')
    .replace(/Ãberdachter/g, 'Überdachter');
}

// Strip HTML tags from annotations
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Escape CSV field
function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: NextRequest) {
  try {
    const { ids, filters } = await request.json();

    let ideas: DbIdea[];

    // If specific IDs provided, filter by them
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      ideas = await query<DbIdea>(
        `SELECT * FROM public.ideas WHERE id IN (${placeholders}) ORDER BY name ASC`,
        ids
      );
    } else if (filters) {
      // Build query with filters
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filters.search) {
        conditions.push(`name ILIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }
      if (filters.minSearches) {
        conditions.push(`searches >= $${paramIndex}`);
        params.push(parseInt(filters.minSearches));
        paramIndex++;
      }
      if (filters.maxSearches) {
        conditions.push(`searches <= $${paramIndex}`);
        params.push(parseInt(filters.maxSearches));
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      ideas = await query<DbIdea>(
        `SELECT * FROM public.ideas ${whereClause} ORDER BY name ASC`,
        params
      );
    } else {
      ideas = await query<DbIdea>('SELECT * FROM public.ideas ORDER BY name ASC');
    }

    if (!ideas || ideas.length === 0) {
      return NextResponse.json(
        { error: 'Keine Daten zum Exportieren' },
        { status: 404 }
      );
    }

    // Build CSV content
    const headers = ['Name', 'Suchanfragen', 'Top Annotations', 'Verwandte Interessen', 'URL'];
    const rows: string[] = [headers.map(escapeCSV).join(',')];

    for (const idea of ideas) {
      const name = fixUmlauts(idea.name || '');
      const searches = idea.searches || 0;
      const annotations = idea.top_annotations
        ? fixUmlauts(stripHtml(idea.top_annotations))
        : '';

      let relatedInterests = '';
      if (idea.related_interests) {
        try {
          const parsed = JSON.parse(idea.related_interests);
          if (Array.isArray(parsed)) {
            relatedInterests = parsed.map((ri: { name: string }) => ri.name).join(', ');
          }
        } catch {
          relatedInterests = '';
        }
      }

      const url = idea.url || '';

      rows.push([
        escapeCSV(name),
        escapeCSV(searches),
        escapeCSV(annotations),
        escapeCSV(fixUmlauts(relatedInterests)),
        escapeCSV(url),
      ].join(','));
    }

    // Add BOM for UTF-8 Excel compatibility
    const bom = '\uFEFF';
    const csvContent = bom + rows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pinspector-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
