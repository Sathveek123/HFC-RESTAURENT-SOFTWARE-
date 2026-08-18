import { supabase } from './supabase'
import { OrderRecord } from '@/store/orderStore'

/**
 * Convert OrderRecord to Supabase public.orders database row format
 */
export function orderToRow(order: OrderRecord) {
  return {
    id: order.id,
    customer_name: order.customerName,
    phone_number: order.phoneNumber,
    order_type: order.orderType,
    address: order.address || null,
    landmark: order.landmark || null,
    delivery_area: order.deliveryArea || null,
    coords: order.coords || null,
    items: order.items,
    subtotal: order.subtotal,
    gst: order.gst,
    delivery_charge: order.deliveryCharge || 0,
    discount_amount: order.discountAmount || 0,
    coupon_code: order.couponCode || null,
    total: order.total,
    payment_method: order.paymentMethod || 'Cash',
    payment_status: order.paymentStatus || 'unpaid',
    status: order.status || 'placed',
    assigned_agent: order.assignedAgent || null,
    seen_by_admin: order.seenByAdmin || false,
    is_regular_customer: order.isRegularCustomer || false,
    notes: order.notes || null,
    created_at: order.createdAt,
    updated_at: order.updatedAt || new Date().toISOString(),
    timestamp: order.timestamp || Date.now(),
    source: order.source || 'website',
    token_number: order.tokenNumber || null,
    packaging_charge: order.packagingCharge || 0,
    picked_up_at: order.pickedUpAt || null,
    kitchen_source: order.kitchenSource || 'HFC Main Kitchen',
    rider_earning: order.riderEarning || 0,
    estimated_delivery_minutes: order.estimatedDeliveryMinutes || 30,
  }
}

/**
 * Convert Supabase public.orders database row to OrderRecord format
 */
export function rowToOrder(row: any): OrderRecord {
  return {
    id: row.id,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    orderType: row.order_type,
    address: row.address || undefined,
    landmark: row.landmark || undefined,
    deliveryArea: row.delivery_area || null,
    coords: row.coords || undefined,
    items: row.items || [],
    subtotal: Number(row.subtotal) || 0,
    gst: Number(row.gst) || 0,
    deliveryCharge: Number(row.delivery_charge) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    couponCode: row.coupon_code || null,
    total: Number(row.total) || 0,
    paymentMethod: row.payment_method || 'Cash',
    paymentStatus: row.payment_status || 'unpaid',
    status: row.status || 'placed',
    assignedAgent: row.assigned_agent || null,
    seenByAdmin: row.seen_by_admin || false,
    isRegularCustomer: row.is_regular_customer || false,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timestamp: Number(row.timestamp) || new Date(row.created_at).getTime(),
    source: row.source || 'website',
    tokenNumber: row.token_number || undefined,
    packagingCharge: row.packaging_charge != null ? Number(row.packaging_charge) : undefined,
    pickedUpAt: row.picked_up_at || null,
    kitchenSource: row.kitchen_source || 'HFC Main Kitchen',
    riderEarning: Number(row.rider_earning) || 0,
    estimatedDeliveryMinutes: Number(row.estimated_delivery_minutes) || 30,
  }
}

// Rate-limiting queue & debounce map to prevent DB flooding
const syncQueueMap = new Map<string, NodeJS.Timeout>()

/**
 * Upsert an order to Supabase cloud DB with rate-limiting & exponential retry.
 * Uses SECURITY DEFINER RPC create_order() as primary — bypasses RLS for both
 * customer INSERTs and admin UPDATEs without needing a valid JWT.
 * Falls back to direct table upsert if RPC itself fails (network/function issue).
 */
export async function syncOrderToSupabase(order: OrderRecord, maxRetries = 3) {
  const orderId = order.id

  // Debounce rapid writes for the same order (200ms throttle)
  if (syncQueueMap.has(orderId)) {
    clearTimeout(syncQueueMap.get(orderId))
  }

  const timer = setTimeout(async () => {
    syncQueueMap.delete(orderId)
    const row = orderToRow(order)

    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      try {
        // Primary: SECURITY DEFINER RPC — bypasses RLS, works for any caller
        // Handles both INSERT (new orders) and UPDATE (status/agent/payment changes)
        const { error: rpcError } = await supabase.rpc('create_order', { order_row: row })

        if (!rpcError) {
          success = true
        } else {
          const { error: directError } = await supabase
            .from('orders')
            .insert(row)

          if (!directError) {
            success = true
          } else {
            attempt++
            if (attempt < maxRetries) {
              await new Promise(res => setTimeout(res, attempt * 500))
            } else {
              console.warn(`Supabase order sync failed after ${attempt} attempts:`, rpcError?.message, directError?.message)
            }
          }
        }
      } catch (err) {
        attempt++
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, attempt * 500))
        } else {
          console.warn('Supabase network offline, order safely preserved in local storage:', err)
        }
      }
    }
  }, 200)

  syncQueueMap.set(orderId, timer)
}

/**
 * Fetch orders from Supabase — LIMITED to last 30 days to protect egress.
 * Tries direct table SELECT first; falls back to SECURITY DEFINER RPC.
 */
export async function fetchOrdersFromSupabase(): Promise<OrderRecord[]> {
  // Only fetch orders from the last 30 days to avoid massive egress on large datasets
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceISO = since.toISOString()

  try {
    // First try: direct table query (works if Supabase Auth session with admin role exists)
    const { data: directData, error: directError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .limit(500)

    // IMPORTANT: RLS blocks return empty [] with NO error — check length > 0
    if (!directError && directData && directData.length > 0) {
      return directData.map(rowToOrder)
    }

    // Fallback: SECURITY DEFINER RPC that bypasses RLS (always works)
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_all_orders')

    if (!rpcError && rpcData) {
      // Apply the 30-day filter client-side on RPC result too
      const sinceMs = since.getTime()
      return (rpcData as any[])
        .filter((r: any) => new Date(r.created_at).getTime() >= sinceMs)
        .map(rowToOrder)
    }

    console.warn('Failed to fetch from Supabase (both direct and RPC):', directError?.message, rpcError?.message)
    return []
  } catch (err) {
    console.warn('Failed to fetch from Supabase:', err)
    return []
  }
}

/**
 * Fetch a single order via SECURITY DEFINER RPC function (prevents bulk DB dumps)
 */
export async function fetchSingleOrderRPC(orderId: string): Promise<OrderRecord | null> {
  try {
    const { data, error } = await supabase.rpc('get_order_by_id', { p_order_id: orderId })
    if (error || !data || data.length === 0) {
      return null
    }
    return rowToOrder(data[0])
  } catch (err) {
    return null
  }
}

/**
 * Atomic Conditional Order Update: WHERE id = orderId AND updated_at = lastKnownUpdatedAt
 * Guarantees zero silent overwrites if another device modified the order in between.
 */
export async function syncOrderStatusAtomic(
  orderId: string, 
  updates: Partial<OrderRecord>, 
  lastKnownUpdatedAt: string
): Promise<{ success: boolean; conflict?: boolean; latestCloudOrder?: OrderRecord }> {
  try {
    const newUpdatedAt = new Date().toISOString()
    
    // ATOMIC CONDITIONAL SQL UPDATE
    const { data, error } = await supabase
      .from('orders')
      .update({
        ...updates,
        updated_at: newUpdatedAt,
        timestamp: Date.now(),
      })
      .eq('id', orderId)
      .eq('updated_at', lastKnownUpdatedAt) // Atomic conditional lock!
      .select()

    if (error || !data || data.length === 0) {
      console.warn(`Atomic lock conflict detected on order ${orderId}! Refetching latest cloud data...`)
      
      // Fetch latest cloud version to merge conflict
      const { data: currentCloudRow } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      const latestCloudOrder = currentCloudRow ? rowToOrder(currentCloudRow) : undefined
      return { success: false, conflict: true, latestCloudOrder }
    }

    return { success: true }
  } catch (err) {
    console.warn('Network issue during atomic order sync:', err)
    return { success: false }
  }
}

/**
 * Subscribe to realtime updates for a single order (for live order tracker)
 */
export function subscribeToOrderRealtime(
  orderId: string,
  onUpdate: (updatedOrder: OrderRecord) => void
) {
  const channel = supabase
    .channel(`order-live-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        if (payload.new) {
          const updated = rowToOrder(payload.new)
          onUpdate(updated)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to ALL order changes in real-time (for Admin Panel & Delivery Portal cross-device sync)
 */
export function subscribeToAllOrdersRealtime(
  onOrderChange: (order: OrderRecord) => void
) {
  const channel = supabase
    .channel(`all-orders-live-${Math.random().toString(36).substring(2, 9)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        if (payload.new) {
          const updated = rowToOrder(payload.new)
          onOrderChange(updated)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function agentToRow(agent: any) {
  return {
    id: agent.id,
    name: agent.name,
    whatsapp: agent.whatsapp,
    username: agent.username,
    is_active: agent.isActive,
    vehicle_type: agent.vehicleType || null,
    coverage_area: agent.coverageArea || null,
    total_deliveries: agent.totalDeliveries || 0,
    delivery_rate: agent.deliveryRate || 40,
    created_at: agent.createdAt,
  }
}

export function rowToAgent(row: any) {
  return {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    username: row.username,
    isActive: row.is_active,
    vehicleType: row.vehicle_type || null,
    coverageArea: row.coverage_area || null,
    totalDeliveries: Number(row.total_deliveries) || 0,
    deliveryRate: Number(row.delivery_rate) || 40,
    createdAt: row.created_at,
  }
}

/**
 * Upsert agent to Supabase cloud DB (bypasses RLS via RPC sync_agent)
 */
export async function syncAgentToSupabase(agent: any) {
  try {
    const row = agentToRow(agent)
    const { error } = await supabase.rpc('sync_agent', { agent_row: row })
    if (error) {
      console.warn('Failed to sync agent to Supabase via RPC:', error.message)
    }
  } catch (err) {
    console.warn('Network issue during agent sync:', err)
  }
}

/**
 * Delete agent from Supabase (bypasses RLS via RPC delete_agent_by_id)
 */
export async function deleteAgentFromSupabase(id: string) {
  try {
    const { error } = await supabase.rpc('delete_agent_by_id', { agent_id: id })
    if (error) {
      console.warn('Failed to delete agent from Supabase via RPC:', error.message)
    }
  } catch (err) {
    console.warn('Network issue during agent deletion:', err)
  }
}

/**
 * Fetch all agents from Supabase (bypasses RLS via RPC get_all_agents)
 */
export async function fetchAgentsFromSupabase(): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('get_all_agents')
    if (error || !data) {
      console.warn('Failed to fetch agents via RPC:', error?.message)
      return []
    }
    return data.map(rowToAgent)
  } catch (err) {
    console.warn('Failed to fetch agents from Supabase:', err)
    return []
  }
}

/**
 * Fetch bills from Supabase — SERVER-SIDE limited to last 30 days (DB-filtered)
 * to protect egress. Old get_all_bills RPC pulled entire table then client-filtered,
 * which meant years of bills shipped over the wire every time.
 */
export async function fetchBillsFromSupabase(): Promise<any[]> {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  try {
    // Path 1: direct REST with server-side .gte() filter — DB only returns 30 days
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .gte('date', sinceIso)
      .order('date', { ascending: false })

    if (!error && data) {
      return data
    }

    // Path 2 (fallback if REST blocked): RPC — filter on server first if possible,
    // otherwise the full RPC output (rare)
    console.warn('Bills REST filter failed — falling back to RPC:', error?.message)
    const rpcRes = await supabase.rpc('get_all_bills')
    if (!rpcRes.error && rpcRes.data) {
      const sinceMs = since.getTime()
      return (rpcRes.data as any[]).filter(
        (bill: any) => new Date(bill.date).getTime() >= sinceMs
      )
    }
    return []
  } catch (err) {
    console.warn('Failed to fetch bills from Supabase:', err)
    return []
  }
}

// ─── PRODUCT SYNC FUNCTIONS ──────────────────────────────────────────────────

import { ProductItem } from '@/store/productsStore'

/**
 * Convert ProductItem (store format) to Supabase public.products row
 */
export function productToRow(item: ProductItem) {
  return {
    id: item.id,
    name: item.name,
    category: item.categoryId,
    price: item.price,
    mrp: item.mrp,
    description: item.description,
    image_url: item.imageUrl,
    is_available: item.isAvailable,
    is_bestseller: item.isBestseller,
    is_veg: item.isVeg,
    sort_order: item.sortOrder,
    updated_at: item.updatedAt,
  }
}

/**
 * Convert Supabase public.products row to ProductItem (store format)
 */
export function rowToProduct(row: any): ProductItem {
  return {
    id: row.id,
    categoryId: row.category,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    mrp: row.mrp != null ? Number(row.mrp) : null,
    imageUrl: row.image_url || null,
    isVeg: row.is_veg ?? true,
    isAvailable: row.is_available ?? true,
    isBestseller: row.is_bestseller ?? false,
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at || new Date().toISOString(),
  }
}

/**
 * Upsert (insert or update) a product in Supabase
 */
export async function syncProductToSupabase(item: ProductItem): Promise<void> {
  try {
    const { error } = await supabase.rpc('sync_product', { product_row: productToRow(item) })
    if (error) {
      console.warn('Failed to sync product to Supabase:', error.message)
    }
  } catch (err) {
    console.warn('Failed to sync product to Supabase:', err)
  }
}

/**
 * Delete a product from Supabase by ID
 */
export async function deleteProductFromSupabase(productId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
    if (error) {
      console.warn('Failed to delete product from Supabase:', error.message)
    }
  } catch (err) {
    console.warn('Failed to delete product from Supabase:', err)
  }
}

/**
 * Fetch all products from Supabase public.products (bypasses RLS)
 */
export async function fetchProductsFromSupabase(): Promise<ProductItem[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error || !data) {
      console.warn('Failed to fetch products from Supabase:', error?.message)
      return []
    }
    return data.map(rowToProduct)
  } catch (err) {
    console.warn('Failed to fetch products from Supabase:', err)
    return []
  }
}

/**
 * Subscribe to real-time product changes from Supabase.
 * Calls onChanged(item) when any product is inserted or updated.
 * Calls onDeleted(id) when a product is deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToProductsRealtime(
  onChanged: (item: ProductItem) => void,
  onDeleted: (id: string) => void
): () => void {
  const channel = supabase
    .channel(`products-realtime-${Math.random().toString(36).substring(2, 9)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onDeleted((payload.old as any).id)
        } else {
          onChanged(rowToProduct(payload.new))
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ─── SETTINGS & PROMOTIONS SYNC FUNCTIONS ─────────────────────────────────────

/**
 * Sync a settings key-value pair to Supabase (bypasses RLS via RPC sync_setting)
 */
export async function syncSettingToSupabase(key: string, value: any): Promise<void> {
  try {
    const { error } = await supabase.rpc('sync_setting', { p_key: key, p_value: value })
    if (error) {
      console.warn(`Failed to sync setting ${key} to Supabase via RPC:`, error.message)
    }
  } catch (err) {
    console.warn(`Failed to sync setting ${key} to Supabase:`, err)
  }
}

/**
 * Fetch a setting from Supabase public.settings table (bypasses RLS)
 */
export async function fetchSettingFromSupabase(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) {
      return null
    }
    return data.value
  } catch (err) {
    console.warn(`Failed to fetch setting ${key} from Supabase:`, err)
    return null
  }
}

/**
 * Subscribe to realtime changes for a specific settings key
 * Listens to ALL events ('*') = both INSERT + UPDATE so first-save ever is picked up.
 */
export function subscribeToSettingRealtime(
  key: string,
  onChanged: (value: any) => void
): () => void {
  const channel = supabase
    .channel(`setting-${key}-realtime-${Math.random().toString(36).substring(2, 9)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${key}` },
      (payload) => {
        if (payload.new && (payload.new as any).value) {
          onChanged((payload.new as any).value)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to realtime agent updates (for Admin Agents page and Order assignment dropdowns)
 */
export function subscribeToAgentsRealtime(
  onChanged: (item: any) => void,
  onDeleted: (id: string) => void
): () => void {
  const channel = supabase
    .channel(`agents-realtime-channel-${Math.random().toString(36).substring(2, 9)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agents' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onDeleted((payload.old as any).id)
        } else {
          onChanged(rowToAgent(payload.new))
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}




