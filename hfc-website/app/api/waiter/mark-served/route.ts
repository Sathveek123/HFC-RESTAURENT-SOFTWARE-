import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

export async function POST(request: Request) {
  try {
    const { orderId, waiterId } = await request.json()

    if (!orderId || !waiterId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Update status to 'served' and log served time (guard: status must be 'ready')
    const { data: updatedOrders, error: updateErr } = await supabaseAdmin
      .from('table_orders')
      .update({
        status: 'served',
        served_by_waiter_at: new Date().toISOString(),
        waiter_id: waiterId
      })
      .eq('id', orderId)
      .eq('status', 'ready')
      .select('id, table_number')

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'INVALID_STATE',
        message: 'Order cannot be marked served (must be in "ready" state and not already served).'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      message: 'Order marked as served successfully.'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
