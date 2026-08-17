import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 5

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1'
    const now = Date.now()
    const limitInfo = rateLimitMap.get(ip)

    if (limitInfo) {
      if (now > limitInfo.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      } else {
        limitInfo.count++
        if (limitInfo.count > MAX_REQUESTS_PER_WINDOW) {
          return NextResponse.json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please wait a minute before submitting more orders.'
          }, { status: 429 })
        }
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }

    const { sessionId, sessionToken, tableNumber, items, subtotal, gst, total, notes } = await request.json()

    if (!sessionId || !sessionToken || !tableNumber || !items || items.length === 0) {
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
        message: 'Only the original ordering device can add items to this table.'
      }, { status: 403 })
    }

    if (session.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'SESSION_CLOSED',
        message: 'This order session is no longer active.'
      }, { status: 400 })
    }

    // 2. Count existing rounds
    const { count: roundCount, error: countErr } = await supabase
      .from('table_orders')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    const newRound = (roundCount || 0) + 1
    const kotNumber = `KOT-${tableNumber}-R${newRound}-${Date.now().toString(36).slice(-4).toUpperCase()}`

    // 3. Insert new round order
    const { error: orderErr } = await supabase
      .from('table_orders')
      .insert({
        id: `${sessionId}-R${newRound}`,
        session_id: sessionId,
        table_number: tableNumber,
        round_number: newRound,
        items,
        subtotal,
        gst,
        total,
        status: 'placed',
        kot_number: kotNumber,
        special_instructions: notes || null
      })

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }

    // 4. Update session total
    const newTotal = (Number(session.total_amount) || 0) + Number(total)
    const { error: updateErr } = await supabase
      .from('table_sessions')
      .update({ total_amount: newTotal })
      .eq('id', sessionId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      kotNumber,
      roundNumber: newRound,
      newSessionTotal: newTotal,
      message: `Round ${newRound} added to Table ${tableNumber}`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
