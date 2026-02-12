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
  position: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get pins for this idea with their positions, ordered by position
    const pins = await query<DbPin>(
      `SELECT p.*, ip.position
       FROM public.pins p
       JOIN public.idea_pins ip ON p.id = ip.pin_id
       WHERE ip.idea_id = $1
       ORDER BY ip.position ASC`,
      [id]
    );

    // Transform dates to ISO strings
    const result = pins.map(pin => ({
      ...pin,
      pin_created_at: pin.pin_created_at?.toISOString() || null,
    }));

    return NextResponse.json({ pins: result });
  } catch (error) {
    console.error('Pins API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
