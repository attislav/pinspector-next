import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = getSupabase();
    const { data: ideaPins, error } = await supabase
      .from('idea_pins')
      .select('position, pins(*)')
      .eq('idea_id', id)
      .order('position', { ascending: true });

    if (error) throw error;

    // Flatten: ideaPins[i].pins contains the pin data
    const pins = (ideaPins || []).map(ip => ({
      ...(ip.pins as unknown as Record<string, unknown>),
      position: ip.position,
    }));

    return NextResponse.json({ pins });
  } catch (error) {
    console.error('Pins API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
