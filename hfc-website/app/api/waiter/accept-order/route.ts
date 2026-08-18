import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

export async function POST(request: Request) {
  try {
    const { orderId, waiterId, waiterName } = await request.json()

    if (!orderId || !waiterId || !waiterName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 1. Generate KOT number
    const kotNumber = `KOT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`

    // 2. Update the order atomically (guard: status must be 'placed' to prevent double accept race)
    const { data: updatedOrders, error: updateErr } = await supabaseAdmin
      .from('table_orders')
      .update({
        status: 'accepted',
        waiter_id: waiterId,
        waiter_name: waiterName,
        accepted_at: new Date().toISOString(),
        kot_number: kotNumber,
      })
      .eq('id', orderId)
      .eq('status', 'placed')
      .select('id, table_number, items, session_id')

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ALREADY_HANDLED',
        message: 'This order was already accepted or rejected by another waiter.'
      }, { status: 409 })
    }

    const acceptedOrder = updatedOrders[0]

    // 3. Dispatch to print_queue table for physical/digital companion printing bridge
    const printJobId = `PRINT-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
    const { error: printErr } = await supabaseAdmin
      .from('print_queue')
      .insert({
        id: printJobId,
        order_id: acceptedOrder.id,
        kot_number: kotNumber,
        table_number: acceptedOrder.table_number,
        items: acceptedOrder.items,
        printed: false,
        created_at: new Date().toISOString()
      })

    if (printErr) {
      console.warn('Failed to insert print job in print_queue (non-blocking):', printErr.message)
    }

    return NextResponse.json({
      success: true,
      kotNumber,
      message: 'Order accepted and KOT dispatched successfully.'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
