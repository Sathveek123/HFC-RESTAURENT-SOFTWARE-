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

    const { tableNumber, firstOrder } = await request.json()

    if (!tableNumber || !firstOrder || !firstOrder.items || firstOrder.items.length === 0) {
      return NextResponse.json({ error: 'Missing table number or order items' }, { status: 400 })
    }

    // 1. Verify if the table is already locked (concurrency race-condition guard)
    const { data: existingSession, error: checkError } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('table_number', tableNumber)
      .in('status', ['active', 'payment_pending'])
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    if (existingSession) {
      return NextResponse.json({
        success: false,
        error: 'TABLE_LOCKED',
        message: 'This table already has an active order. Please wait or ask the staff.'
      }, { status: 409 })
    }

    // Fetch the table master ID to link
    const { data: tableData } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('table_number', tableNumber)
      .maybeSingle()

    const tableId = tableData?.id || null

    // 2. Generate a unique session token for this device
    const sessionToken = crypto.randomUUID()
    const sessionId = `TBL-${tableNumber}-${Date.now().toString(36).toUpperCase()}`
    const kotNumber = `KOT-${tableNumber}-${Date.now().toString(36).slice(-4).toUpperCase()}`

    // 3. Create active session (LOCK the table)
    const { error: sessionErr } = await supabase
      .from('table_sessions')
      .insert({
        id: sessionId,
        table_id: tableId,
        table_number: tableNumber,
        session_token: sessionToken,
        status: 'active',
        total_amount: firstOrder.total,
        payment_status: 'unpaid'
      })

    if (sessionErr) {
      return NextResponse.json({ error: sessionErr.message }, { status: 500 })
    }

    // 4. Create first order round
    const { error: orderErr } = await supabase
      .from('table_orders')
      .insert({
        id: `${sessionId}-R1`,
        session_id: sessionId,
        table_number: tableNumber,
        round_number: 1,
        items: firstOrder.items,
        subtotal: firstOrder.subtotal,
        gst: firstOrder.gst,
        total: firstOrder.total,
        status: 'placed',
        kot_number: kotNumber,
        special_instructions: firstOrder.notes || null
      })

    if (orderErr) {
      // Cleanup session if order creation fails to avoid dangling locks
      await supabase.from('table_sessions').delete().eq('id', sessionId)
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessionId,
      sessionToken, // Stored in localStorage of ordering device
      kotNumber,
      message: `Table ${tableNumber} locked. Order sent to kitchen.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
