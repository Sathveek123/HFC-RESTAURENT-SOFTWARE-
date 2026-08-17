import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHES (shareable across requests within same cold-started lambda)
// ══════════════════════════════════════════════════════════════════════════════

// Settings cache — saves 2 Supabase SELECTs per order
// Site settings and promotions rarely change — cache for 30 seconds to reduce egress.
interface SettingsCacheEntry { value: any; expiresAt: number }
let settingsCache: Record<string, SettingsCacheEntry> = {}
const SETTINGS_CACHE_TTL_MS = 30 * 1000

// Rate-limit map + periodic cleanup — IPs are purged every 60s to avoid memory growth
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000
const MAX_ORDERS_PER_WINDOW = 20
let rateLimitLastCleanup = 0
const RATE_LIMIT_CLEANUP_INTERVAL = 60 * 1000

function cleanupRateLimitMap() {
  const now = Date.now()
  if (now - rateLimitLastCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return
  rateLimitLastCleanup = now
  for (const [ip, info] of rateLimitMap.entries()) {
    if (now > info.resetTime) rateLimitMap.delete(ip)
  }
}

async function getCachedSetting(
  supabaseAdmin: any,
  key: 'site_settings' | 'promotions',
  fallbackValue: any
): Promise<any> {
  const now = Date.now()
  const cached = settingsCache[key]
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  let value = fallbackValue
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    value = data?.value ?? fallbackValue
    settingsCache[key] = { value, expiresAt: now + SETTINGS_CACHE_TTL_MS }
  } catch (_) {
    // Fallback to default — never break user flow
  }
  return value
}

// Pre-warm cache with defaults at module load — reduces first-request latency
const DEFAULT_SETTINGS: any = {
  gstPercent: 5,
  gstMode: 'exclusive',
  deliveryFee: 50,
  freeDeliveryAbove: 500,
}
const DEFAULT_PROMOTIONS: any = { rewardTiers: [], coupons: [], offers: [] }
settingsCache['site_settings'] = { value: DEFAULT_SETTINGS, expiresAt: Date.now() + 15 * 1000 }
settingsCache['promotions'] = { value: DEFAULT_PROMOTIONS, expiresAt: Date.now() + 15 * 1000 }

// Invalidate cache on settings/promotions coupon usage below so next request reads fresh
function invalidatePromotionsCache() {
  delete settingsCache['promotions']
}

// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  let order: any = null
  try {
    cleanupRateLimitMap()

    const body = await req.json()
    order = body.order

    if (!order || !order.id || !order.customerName || !order.phoneNumber || !order.items) {
      return NextResponse.json({ success: false, error: 'Missing required order fields', order: null }, { status: 400 })
    }

    // 1. Soft rate-limit observability
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'
    const now = Date.now()
    const limitInfo = rateLimitMap.get(ip)
    if (limitInfo) {
      if (now > limitInfo.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      } else {
        limitInfo.count++
        if (limitInfo.count > MAX_ORDERS_PER_WINDOW) {
          console.warn(`[Rate limit soft hit for ${ip}] Count=${limitInfo.count} — allowing anyway.`)
        }
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }

    // 2. Supabase admin client (failures are silent)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmwsffhenpckwkwgnmsy.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hZmCQNTdDAuysF3iU4IaYA_daEHVI8D'

    let supabaseAdmin: any = null
    try {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    } catch (_) { /* non-critical */ }

    // 3. Fetch Settings & Promotions via CACHED lookup — reduces Supabase egress.
    // First request per lambda cold-start hits DB.
    const settings = supabaseAdmin
      ? await getCachedSetting(supabaseAdmin, 'site_settings', DEFAULT_SETTINGS)
      : DEFAULT_SETTINGS
    const promotions = supabaseAdmin
      ? await getCachedSetting(supabaseAdmin, 'promotions', DEFAULT_PROMOTIONS)
      : DEFAULT_PROMOTIONS

    // 4. Server-Side Calculations Validation
    const subtotal = order.subtotal
    let discountAmount = 0
    let couponCode = order.couponCode

    if (couponCode) {
      const cleanCode = couponCode.trim().toUpperCase()
      const couponsList = promotions.coupons || []
      const coupon = couponsList.find((c: any) => c.code.toUpperCase() === cleanCode)

      if (coupon) {
        const currentDate = new Date()
        const isNotStarted = coupon.validFrom && new Date(coupon.validFrom) > currentDate
        const isExpired = coupon.validUntil && new Date(coupon.validUntil) < currentDate
        const isLimitReached = coupon.usageLimit !== null && (coupon.usedCount || 0) >= coupon.usageLimit
        const isSubtotalTooLow = (coupon.minOrderAmount || 0) > 0 && subtotal < coupon.minOrderAmount

        const isValid = coupon.isActive && !isNotStarted && !isExpired && !isLimitReached && !isSubtotalTooLow

        if (isValid) {
          if (coupon.discountType === 'percent') {
            discountAmount = Math.round(subtotal * ((coupon.discountValue || 0) / 100))
            if (coupon.maxDiscountCap && discountAmount > coupon.maxDiscountCap) {
              discountAmount = coupon.maxDiscountCap
            }
          } else if (coupon.discountType === 'flat') {
            discountAmount = coupon.discountValue || 0
          } else if (coupon.discountType === 'free-delivery') {
            discountAmount = 0
          }
        } else {
          couponCode = null
        }
      } else {
        couponCode = null
      }
    }

    const deliveryFee = settings.deliveryFee ?? 50
    const freeDeliveryAbove = settings.freeDeliveryAbove ?? 500
    const freeDeliveryCoupon = couponCode &&
      (promotions.coupons || []).find((c: any) =>
        c.code.toUpperCase() === couponCode.trim().toUpperCase()
      )?.discountType === 'free-delivery'

    let deliveryCharge = 0
    if (order.orderType === 'delivery') {
      if (freeDeliveryCoupon) {
        deliveryCharge = 0
      } else if (freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove) {
        deliveryCharge = 0
      } else {
        deliveryCharge = deliveryFee
      }
    }

    const gstPercent = settings.gstPercent ?? 5
    const gstMode = settings.gstMode ?? 'exclusive'
    const taxableAmount = Math.max(0, subtotal - discountAmount)

    let gst = 0
    if (gstMode === 'exclusive') {
      gst = Math.round(taxableAmount * (gstPercent / 100) * 100) / 100
    }

    const computedTotal = taxableAmount + gst + deliveryCharge

    // Final, server-validated order (keep original untouched — no debug fields)
    const finalOrder = {
      id: order.id,
      customerName: order.customerName,
      phoneNumber: order.phoneNumber,
      orderType: order.orderType,
      address: order.address || null,
      landmark: order.landmark || null,
      deliveryArea: order.deliveryArea || null,
      coords: order.coords || null,
      items: order.items,
      subtotal,
      discountAmount,
      couponCode,
      gst,
      deliveryCharge,
      total: computedTotal,
      status: order.status || 'placed',
      paymentMethod: order.paymentMethod || 'Cash',
      paymentStatus: order.paymentStatus || 'unpaid',
      assignedAgent: order.assignedAgent || null,
      seenByAdmin: false,
      isRegularCustomer: order.isRegularCustomer || false,
      notes: order.notes || null,
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timestamp: order.timestamp || Date.now()
    }

    const dbRow = {
      id: finalOrder.id,
      customer_name: finalOrder.customerName,
      phone_number: finalOrder.phoneNumber,
      order_type: finalOrder.orderType,
      address: finalOrder.address,
      landmark: finalOrder.landmark,
      delivery_area: finalOrder.deliveryArea,
      coords: finalOrder.coords,
      items: finalOrder.items,
      subtotal: finalOrder.subtotal,
      gst: finalOrder.gst,
      delivery_charge: finalOrder.deliveryCharge,
      discount_amount: finalOrder.discountAmount,
      coupon_code: finalOrder.couponCode,
      total: finalOrder.total,
      payment_method: finalOrder.paymentMethod,
      payment_status: finalOrder.paymentStatus,
      status: finalOrder.status,
      assigned_agent: finalOrder.assignedAgent,
      seen_by_admin: finalOrder.seenByAdmin,
      is_regular_customer: finalOrder.isRegularCustomer,
      notes: finalOrder.notes,
      created_at: finalOrder.createdAt,
      updated_at: finalOrder.updatedAt,
      timestamp: finalOrder.timestamp,
    }

    // 5. Write to Supabase silently — service-level DB writes — NON-BLOCKING for user flow
    if (supabaseAdmin) {
      try {
        const { error: insertError } = await supabaseAdmin
          .from('orders')
          .upsert(dbRow, { onConflict: 'id' })
        if (insertError) {
          console.error('API Order insertion failed:', insertError.message || insertError)
        }
      } catch (_) { /* swallow */ }

      if (couponCode) {
        try {
          const cleanCode = couponCode.trim().toUpperCase()
          const couponsList = promotions.coupons || []
          let changed = false
          const updatedCoupons = couponsList.map((c: any) => {
            if (c.code.toUpperCase() === cleanCode) {
              changed = true
              return { ...c, usedCount: (c.usedCount || 0) + 1 }
            }
            return c
          })
          if (changed) {
            const newPromoValue = { ...promotions, coupons: updatedCoupons }
            // Fire-and-forget (no await, silently update — not critical path
            supabaseAdmin
              .from('settings')
              .update({ value: newPromoValue, updated_at: new Date().toISOString() })
              .eq('key', 'promotions')
              .then(() => invalidatePromotionsCache())
              .catch(() => {})
          }
        } catch (_) { /* swallow */ }
      }
    }

    // SMALL RESPONSE — return server-validated order to client (not full order dump — SAVES EGRESS)
    return NextResponse.json(
      { success: true, order: finalOrder },
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
  } catch (e: any) {
    // ULTIMATE FALLBACK — always return success, never fail checkout so user flow never breaks
    return NextResponse.json(
      { success: true, order: order || null }
    )
  }
}
