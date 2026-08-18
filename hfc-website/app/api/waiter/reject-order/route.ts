import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

export async function POST(request: Request) {
  try {
    const { orderId, waiterId, reason } = await request.json()

    if (!orderId || !waiterId || !reason) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 1. Update the order status to 'rejected' atomically
    const { data: updatedOrders, error: updateErr } = await supabaseAdmin
      .from('table_orders')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        waiter_id: waiterId,
      })
      .eq('id', orderId)
      .eq('status', 'placed')
      .select('session_id, table_number')

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

    const rejectedOrder = updatedOrders[0]

    // 2. Check if this table session has any other active ordering rounds left
    const { count: remainingRounds, error: countErr } = await supabaseAdmin
      .from('table_orders')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', rejectedOrder.session_id)
      .neq('status', 'rejected')

    if (countErr) {
      console.warn('Failed to query remaining table orders (non-blocking):', countErr.message)
    }

    // If there are 0 active ordering rounds remaining, release/unlock the table session
    if (remainingRounds === 0) {
      const { error: releaseErr } = await supabaseAdmin
        .from('table_sessions')
        .update({
          status: 'released',
          released_at: new Date().toISOString()
        })
        .eq('id', rejectedOrder.session_id)

      if (releaseErr) {
        console.warn('Failed to auto-release table session (non-blocking):', releaseErr.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order rejected successfully.'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
