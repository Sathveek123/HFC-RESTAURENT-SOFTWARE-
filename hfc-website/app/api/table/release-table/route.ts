import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { sessionId, tableNumber, paymentMethod, isForceRelease } = await request.json()

    if (!sessionId || !tableNumber) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Fail-closed Admin JWT Verification
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: missing authorization token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token)

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 })
    }

    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const finalStatus = isForceRelease ? 'released' : 'completed'
    const paymentStatus = isForceRelease ? 'unpaid' : 'paid'

    // 1. Update session to completed/released
    const { error: sessionErr } = await supabaseAdmin
      .from('table_sessions')
      .update({
        status: finalStatus,
        payment_method: paymentMethod || 'Cash',
        payment_status: paymentStatus,
        released_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (sessionErr) {
      return NextResponse.json({ error: sessionErr.message }, { status: 500 })
    }

    // 2. Mark all orders in this session as served
    const { error: orderErr } = await supabaseAdmin
      .from('table_orders')
      .update({
        status: 'served',
        served_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }

    // 3. (Optional) Auto-write this to the core "bills" table to keep billing history uniform!
    // Let's query the session total and items to create a unified bill entry if not force released
    if (!isForceRelease) {
      const { data: orderRounds } = await supabaseAdmin
        .from('table_orders')
        .select('*')
        .eq('session_id', sessionId)

      if (orderRounds && orderRounds.length > 0) {
        // Flatten items from all rounds
        const allItems: any[] = []
        let subtotal = 0
        let gst = 0
        let total = 0

        orderRounds.forEach(round => {
          if (Array.isArray(round.items)) {
            allItems.push(...round.items)
          }
          subtotal += Number(round.subtotal) || 0
          gst += Number(round.gst) || 0
          total += Number(round.total) || 0
        })

        // Generate unique bill number
        const billNo = `BILL-TBL-${tableNumber}-${Date.now().toString(36).slice(-5).toUpperCase()}`

        await supabaseAdmin
          .from('bills')
          .insert({
            bill_no: billNo,
            order_id: sessionId,
            customer_name: `Table ${tableNumber} Customer`,
            customer_phone: '0000000000',
            order_type: 'dine-in',
            items: allItems,
            subtotal,
            gst,
            delivery_charge: 0,
            discount_amount: 0,
            total,
            payment_method: paymentMethod || 'Cash',
            payment_status: 'paid',
            order_status: 'delivered',
            date: new Date().toISOString()
          })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Table ${tableNumber} released successfully. Ready for next session.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
