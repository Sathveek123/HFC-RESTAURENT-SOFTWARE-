import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tableNumber = searchParams.get('table')
    const requestingToken = searchParams.get('token') // session token from localStorage, optional

    if (!tableNumber) {
      return NextResponse.json({ error: 'Missing table parameter' }, { status: 400 })
    }

    // Check if there is an active session for this table (either 'active' or 'payment_pending')
    const { data: session, error } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_number', tableNumber)
      .in('status', ['active', 'payment_pending'])
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ locked: false, session: null })
    }

    // Auto-release check (3-hour inactivity auto-release guard)
    const elapsedMs = Date.now() - new Date(session.started_at).getTime()
    const threeHoursMs = 3 * 60 * 60 * 1000 // 3 hours
    if (elapsedMs > threeHoursMs) {
      await supabase
        .from('table_sessions')
        .update({
          status: 'released',
          notes: 'AUTO_RELEASED_INACTIVITY',
          released_at: new Date().toISOString()
        })
        .eq('id', session.id)

      await supabase
        .from('table_orders')
        .update({
          status: 'served',
          served_at: new Date().toISOString()
        })
        .eq('session_id', session.id)

      return NextResponse.json({ locked: false, session: null })
    }

    // ─── SECURITY: Owner vs Stranger check ───────────────────────────────────
    // The requesting device is the owner ONLY if it provides the session_token
    // that was issued exclusively to the ordering device at create-session time.
    const isOwner = !!requestingToken && requestingToken === session.session_token

    if (isOwner) {
      // Count existing round KOTs for this session
      const { count: roundCount } = await supabase
        .from('table_orders')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)

      // Full details — only the actual table owner gets this
      return NextResponse.json({
        locked: true,
        isOwner: true,
        sessionId: session.id,
        startedAt: session.started_at,
        totalAmount: Number(session.total_amount) || 0,
        paymentStatus: session.payment_status,
        status: session.status,
        roundCount: roundCount || 0
      })
    }

    // NOT the owner — return ONLY the bare "occupied" signal.
    // No total, no items, no payment status, no session ID — nothing they 
    // could exploit to monitor or copy another table's order.
    return NextResponse.json({
      locked: true,
      isOwner: false,
      message: 'This table is currently occupied by another party.'
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
