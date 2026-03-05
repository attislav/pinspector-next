import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

const STALE_TIMEOUT_MINUTES = 10;

export async function GET() {
  try {
    const supabase = getSupabase();

    // Auto-cleanup: mark stale "running" entries (older than 10 minutes) as failed
    const cutoff = new Date(Date.now() - STALE_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        error: `Timeout: Scrape lief länger als ${STALE_TIMEOUT_MINUTES} Minuten ohne Antwort`,
        completed_at: new Date().toISOString(),
      })
      .eq('status', 'running')
      .lt('started_at', cutoff);

    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing log id' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        error: 'Manuell abgebrochen',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'running');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
