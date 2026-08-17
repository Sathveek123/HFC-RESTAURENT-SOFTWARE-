import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncOrderToSupabase } from '@/lib/supabaseSync'

export type OrderType = 'dine-in' | 'takeaway' | 'delivery'
export type OrderStatus = 'placed' | 'accepted' | 'ready' | 'picked-up' | 'delivered' | 'rejected' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'partial'

// ─── Collision-proof Order ID ────────────────────────────────────────────────
// Uses crypto.randomUUID (built into all modern browsers) — zero dependencies,
// no millisecond-collision risk like Date.now().toString(36)
export function generateOrderId(): string {
  const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `HFC-${uid}`
}

// ─── Sanitize user-supplied strings (XSS defense) ───────────────────────────
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

export interface OrderRecord {
  id: string
  customerName: string
  phoneNumber: string          // canonical phone field
  orderType: OrderType
  address?: string             // canonical address field
  landmark?: string
  deliveryArea?: string | null
  coords?: { lat: number; lng: number }   // canonical GPS field
  items: { id: string; name: string; price: number; quantity: number }[]
  subtotal: number
  gst: number
  deliveryCharge: number       // required, default 0
  discountAmount: number       // required, default 0
  couponCode?: string | null
  total: number
  paymentMethod: 'Cash' | 'UPI' | 'Online' | 'Card'  // required, default 'Cash'
  paymentStatus: PaymentStatus
  status: OrderStatus
  assignedAgent: string | null  // required, default null
  seenByAdmin: boolean          // required, default false
  isRegularCustomer: boolean    // required, default false
  notes?: string | null
  createdAt: string
  updatedAt: string            // required — always set on write
  timestamp: number            // unix ms — for sorting
}

interface OrderStore {
  orders: OrderRecord[]
  _hasHydrated: boolean
  addOrder: (order: Omit<OrderRecord, 'timestamp' | 'updatedAt' | 'seenByAdmin'> & Partial<Pick<OrderRecord, 'timestamp' | 'updatedAt' | 'seenByAdmin'>>) => void
  /** Bulk-merge orders from DB fetch — upserts by ID, never creates duplicates */
  upsertOrders: (incoming: OrderRecord[]) => void
  /** Single-order upsert for realtime subscription callbacks — updates if newer, inserts if new */
  upsertOrder: (order: OrderRecord) => void
  updateOrderStatus: (id: string, status: OrderStatus) => void
  updatePaymentStatus: (id: string, paymentStatus: PaymentStatus) => void
  updatePaymentMethod: (id: string, method: OrderRecord['paymentMethod']) => void
  assignAgent: (id: string, agentName: string | null | undefined) => void
  cancelOrder: (id: string) => void
  markSeenByAdmin: (ids: string[]) => void
  markAsSeen: (id: string) => void
  addToRegularCustomers: (id: string) => void
  duplicateOrder: (id: string) => OrderRecord | undefined
  clearOrders: () => void
  getOrderById: (id: string) => OrderRecord | undefined
  setHasHydrated: (val: boolean) => void
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [],
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      addOrder: (newOrder) => {
        // Prevent duplicate order insertion (e.g. double click on checkout confirmation)
        const existing = get().orders.find(o => o.id === newOrder.id)
        if (existing) {
          console.warn('Order already exists, skipping duplicate add:', newOrder.id)
          return
        }

        const now = new Date()
        const order: OrderRecord = {
          ...newOrder,
          deliveryCharge: newOrder.deliveryCharge ?? 0,
          discountAmount: newOrder.discountAmount ?? 0,
          assignedAgent: newOrder.assignedAgent ?? null,
          seenByAdmin: newOrder.seenByAdmin ?? false,
          isRegularCustomer: newOrder.isRegularCustomer ?? false,
          paymentMethod: newOrder.paymentMethod || 'Cash',
          paymentStatus: newOrder.paymentStatus || 'unpaid',
          timestamp: now.getTime(),
          updatedAt: now.toISOString(),
        }

        let updatedOrders = [order, ...get().orders]

        // Archive oldest orders if count exceeds 500
        if (updatedOrders.length > 500) {
          const archiveCount = 100
          const toKeep = updatedOrders.slice(0, updatedOrders.length - archiveCount)
          const toArchive = updatedOrders.slice(updatedOrders.length - archiveCount)

          try {
            const currentArchiveStr = localStorage.getItem('hfc-orders-archive') || '[]'
            const currentArchive = JSON.parse(currentArchiveStr)
            const newArchive = [...toArchive, ...currentArchive].slice(0, 1000)
            localStorage.setItem('hfc-orders-archive', JSON.stringify(newArchive))
          } catch (e) {
            console.error('Failed to write to local orders archive:', e)
          }

          updatedOrders = toKeep
        }

        set({ orders: updatedOrders })
        syncOrderToSupabase(order)

        // Trigger dynamic theoretical inventory depletion calculation on dashboard
        try {
          const { useBillsStore } = require('./billsStore')
          useBillsStore.getState().createBill(order)
        } catch (e) {
          console.error('Failed to auto-create bill on order placement:', e)
        }
      },

      // Bulk upsert: replace existing orders by ID, insert new ones — never duplicates
      upsertOrders: (incoming) => {
        const existing = get().orders
        const existingMap = new Map(existing.map(o => [o.id, o]))
        incoming.forEach(o => existingMap.set(o.id, o))
        const merged = Array.from(existingMap.values())
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        set({ orders: merged })
      },

      // Single upsert for realtime subscription: update if newer, insert if not present
      upsertOrder: (incoming) => {
        const existing = get().orders
        const idx = existing.findIndex(o => o.id === incoming.id)
        if (idx === -1) {
          // New order — prepend
          set({ orders: [incoming, ...existing] })
        } else {
          // Update only if incoming is newer
          const current = existing[idx]
          const incomingTs = incoming.timestamp ?? new Date(incoming.updatedAt).getTime()
          const currentTs = current.timestamp ?? new Date(current.updatedAt).getTime()
          if (incomingTs >= currentTs) {
            const updated = [...existing]
            updated[idx] = incoming
            set({ orders: updated })
          }
        }
      },

      updateOrderStatus: (id, status) => {
        const order = get().orders.find(o => o.id === id)
        if (!order) return

        const isDelivery = order.orderType === 'delivery'
        const isDeliveredStatus = status === 'delivered'
        const isCashPayment = order.paymentMethod === 'Cash'
        const isUnpaid = order.paymentStatus !== 'paid'
        const autoPayment = isDelivery && isDeliveredStatus && isCashPayment && isUnpaid

        const updatedOrder: OrderRecord = {
          ...order,
          status,
          paymentStatus: autoPayment ? 'paid' : order.paymentStatus,
          updatedAt: new Date().toISOString(),
        }

        set({
          orders: get().orders.map(o => (o.id === id ? updatedOrder : o)),
        })
        syncOrderToSupabase(updatedOrder)

        // Sync bill payment status on COD auto-pay
        if (autoPayment) {
          try {
            const { useBillsStore } = require('./billsStore')
            const billsStore = useBillsStore.getState()
            const bill = billsStore.bills.find((b: any) => b.orderId === id)
            if (bill && bill.paymentStatus !== 'paid') {
              billsStore.updatePaymentStatus(bill.billNo, 'paid')
            }
          } catch (e) {
            console.error('Failed to sync COD payment on delivery:', e)
          }
        }
      },

      updatePaymentStatus: (id, paymentStatus) => {
        const order = get().orders.find(o => o.id === id)
        if (!order || order.paymentStatus === paymentStatus) return

        const updatedOrder: OrderRecord = {
          ...order,
          paymentStatus,
          updatedAt: new Date().toISOString(),
        }

        set({
          orders: get().orders.map(o => (o.id === id ? updatedOrder : o)),
        })
        syncOrderToSupabase(updatedOrder)

        // Sync to bills
        try {
          const { useBillsStore } = require('./billsStore')
          const billsStore = useBillsStore.getState()
          const bill = billsStore.bills.find((b: any) => b.orderId === id)
          if (bill && bill.paymentStatus !== paymentStatus) {
            billsStore.updatePaymentStatus(bill.billNo, paymentStatus)
          }
        } catch (e) {
          console.error('Failed to sync payment status from orders to bills:', e)
        }
      },

      updatePaymentMethod: (id, method) => {
        const order = get().orders.find(o => o.id === id)
        if (!order) return
        const updatedOrder: OrderRecord = {
          ...order,
          paymentMethod: method,
          updatedAt: new Date().toISOString(),
        }
        set({
          orders: get().orders.map(o => (o.id === id ? updatedOrder : o)),
        })
        syncOrderToSupabase(updatedOrder)
      },

      assignAgent: (id, agentName) => {
        const order = get().orders.find(o => o.id === id)
        if (!order) return
        const updatedOrder: OrderRecord = {
          ...order,
          assignedAgent: agentName || null,
          updatedAt: new Date().toISOString(),
        }
        set({
          orders: get().orders.map(o => (o.id === id ? updatedOrder : o)),
        })
        syncOrderToSupabase(updatedOrder)
      },

      cancelOrder: (id) => {
        const order = get().orders.find(o => o.id === id)
        if (!order) return
        const updatedOrder: OrderRecord = {
          ...order,
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        }
        set({
          orders: get().orders.map(o => (o.id === id ? updatedOrder : o)),
        })
        syncOrderToSupabase(updatedOrder)
      },

      markSeenByAdmin: (ids) => {
        set({
          orders: get().orders.map(o =>
            ids.includes(o.id) ? { ...o, seenByAdmin: true, updatedAt: new Date().toISOString() } : o
          ),
        })
      },

      markAsSeen: (id) => {
        set({
          orders: get().orders.map(o =>
            o.id === id ? { ...o, seenByAdmin: true, updatedAt: new Date().toISOString() } : o
          ),
        })
      },

      addToRegularCustomers: (id) => {
        const order = get().orders.find(o => o.id === id)
        if (!order) return

        set({
          orders: get().orders.map(o =>
            o.id === id ? { ...o, isRegularCustomer: true, updatedAt: new Date().toISOString() } : o
          ),
        })

        try {
          const listStr = localStorage.getItem('hfc-regular-customers') || '[]'
          const list = JSON.parse(listStr)
          const customer = { name: order.customerName, phone: order.phoneNumber }

          if (!list.some((c: any) => c.phone === customer.phone)) {
            localStorage.setItem('hfc-regular-customers', JSON.stringify([...list, customer]))
          }
        } catch (e) {
          console.error('Failed to write to regular customers:', e)
        }
      },

      duplicateOrder: (id) => {
        const original = get().orders.find(o => o.id === id)
        if (!original) return undefined

        const duplicate: OrderRecord = {
          ...original,
          id: generateOrderId(),  // collision-proof
          status: 'placed',
          paymentStatus: 'unpaid',
          seenByAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          timestamp: Date.now(),
        }

        get().addOrder(duplicate)
        return duplicate
      },

      clearOrders: () => {
        set({ orders: [] })
      },

      getOrderById: (id) => {
        return get().orders.find(o => o.id === id)
      },
    }),
    {
      name: 'hfc-orders',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
