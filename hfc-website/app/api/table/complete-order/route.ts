import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { sessionId, sessionToken } = await request.json()

    if (!sessionId || !sessionToken) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 1. Verify session token matches
    const { data: session, error: sessionFetchErr } = await supabase
      .from('table_sessions')
      .select('session_token, status, total_amount')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionFetchErr) {
      return NextResponse.json({ error: sessionFetchErr.message }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ success: false, error: 'SESSION_NOT_FOUND', message: 'Order session not found.' }, { status: 404 })
    }

    if (session.session_token !== sessionToken) {
      return NextResponse.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Only the original ordering device can request checkout.'
      }, { status: 403 })
    }

    // 2. Set session status to payment_pending
    const { error: updateErr } = await supabase
      .from('table_sessions')
      .update({
        status: 'payment_pending',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Bill finalized. Redirecting to payment...',
      totalAmount: Number(session.total_amount) || 0
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
