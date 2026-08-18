import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// Rate-limiting map (Max 10 requests per IP per hour to prevent API spam)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 10

async function generateCounterToken(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('orders')
    .select('token_number')
    .eq('source', 'counter-qr')
    .gte('created_at', `${today}T00:00:00`)
    .not('token_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.token_number) {
    return 'TA0001'
  }

  const lastNum = parseInt((data.token_number as string).replace('TA', ''), 10)
  const nextNum = (lastNum + 1).toString().padStart(4, '0')
  return `TA${nextNum}`
}

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
        if (limitInfo.count > MAX_REQUESTS) {
          return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
        }
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }

    const body = await request.json()
    const { items, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 })
    }

    // 1. Fetch live product prices from database to prevent DevTools price modification
    const productIds = items.map((i: any) => i.id)
    const { data: dbProducts, error: dbErr } = await supabase
      .from('products')
      .select('id, price, name, is_available')
      .in('id', productIds)

    if (dbErr || !dbProducts) {
      return NextResponse.json({ error: 'Failed to verify items' }, { status: 500 })
    }

    // Verify all items exist and are available
    let computedSubtotal = 0
    const verifiedItems = []

    for (const clientItem of items) {
      const dbProduct = dbProducts.find(p => p.id === clientItem.id)
      if (!dbProduct) {
        return NextResponse.json({ error: `Product ${clientItem.name || clientItem.id} does not exist.` }, { status: 400 })
      }
      if (!dbProduct.is_available) {
        return NextResponse.json({ error: `${dbProduct.name} is currently out of stock.` }, { status: 400 })
      }

      const itemQty = Math.max(1, parseInt(clientItem.quantity, 10) || 1)
      const itemPrice = Number(dbProduct.price)
      computedSubtotal += itemPrice * itemQty

      verifiedItems.push({
        id: dbProduct.id,
        name: dbProduct.name,
        price: itemPrice,
        quantity: itemQty,
        notes: clientItem.notes || ''
      })
    }

    // 2. Fetch packaging fee and GST mode from settings table
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'site_settings')
      .maybeSingle()

    const settings = settingsData?.value || {}
    const activePackagingCharge = Number(settings.packagingCharge ?? 10)
    const gstPercent = Number(settings.gstPercent ?? 5)
    const gstMode = settings.gstMode ?? 'exclusive'

    let computedGst = 0
    if (gstMode === 'exclusive') {
      computedGst = Math.round(computedSubtotal * (gstPercent / 100) * 100) / 100
    }

    const computedTotal = computedSubtotal + activePackagingCharge + computedGst

    // Generate token and order ID
    const tokenNumber = await generateCounterToken()
    const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
    const orderId = `HFC-${uid}`
    const now2 = new Date().toISOString()

    // 3. Insert server-side calculated totals into main orders table
    const { error: insertErr } = await supabase.from('orders').insert({
      id: orderId,
      customer_name: 'Counter Guest',
      phone_number: 'counter',
      order_type: 'takeaway',
      source: 'counter-qr',
      token_number: tokenNumber,
      items: verifiedItems,
      subtotal: computedSubtotal,
      packaging_charge: activePackagingCharge,
      gst: computedGst,
      delivery_charge: 0,
      discount_amount: 0,
      total: computedTotal,
      payment_method: 'UPI',
      payment_status: 'unpaid',
      status: 'placed',
      assigned_agent: null,
      seen_by_admin: false,
      is_regular_customer: false,
      notes: notes || null,
      created_at: now2,
      updated_at: now2,
      timestamp: Date.now(),
    })

    if (insertErr) {
      // Fallback insert structure for safety
      const { error: fallbackErr } = await supabase.from('orders').insert({
        id: orderId,
        customer_name: 'Counter Guest',
        phone_number: 'counter',
        order_type: 'takeaway',
        items: verifiedItems,
        subtotal: computedSubtotal,
        gst: computedGst,
        delivery_charge: 0,
        discount_amount: 0,
        total: computedTotal,
        payment_method: 'UPI',
        payment_status: 'unpaid',
        status: 'placed',
        assigned_agent: null,
        seen_by_admin: false,
        is_regular_customer: false,
        notes: (notes ? notes + ' [counter-qr]' : '[counter-qr]') + ` Token:${tokenNumber}`,
        created_at: now2,
        updated_at: now2,
        timestamp: Date.now(),
      })

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      tokenNumber,
      total: computedTotal,
      message: `Counter order placed. Token: ${tokenNumber}`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
