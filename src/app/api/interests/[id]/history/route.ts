import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { IdeaHistory } from '@/types/database';

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

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_monthly_history', {
      p_idea_id: id,
    });

    if (error) throw error;

    return NextResponse.json((data || []) as IdeaHistory[]);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
