import { create } from 'zustand'
import toast from 'react-hot-toast'
import { CartItem, MenuItem } from '@/types'

const SESSION_KEY = 'hfc-table-session'

export interface TableSessionState {
  sessionId: string
  sessionToken: string
  tableNumber: string
  status: 'active' | 'payment_pending' | 'completed' | 'released'
  totalAmount: number
  roundCount: number
  startedAt: string
}

interface TableStore {
  currentSession: TableSessionState | null
  tableNumber: string | null
  cartItems: CartItem[]
  isSessionLoading: boolean

  // Core Actions
  initSession(tableNumber: string): void
  checkTableStatus(tableNumber: string): Promise<{
    locked: boolean
    session: any | null
  }>
  placeFirstOrder(tableNumber: string, items: CartItem[], notes?: string): Promise<boolean>
  addMoreItems(notes?: string): Promise<boolean>
  completeOrder(): Promise<boolean>
  clearTableSession(): void

  // Cart Actions
  addToCart: (item: MenuItem) => void
  removeFromCart: (id: string) => void
  updateCartQuantity: (id: string, delta: number) => void
  clearCart: () => void

  // Helpers
  hasSessionToken(tableNumber: string): boolean
  getCartTotal(): number
  getCartItemCount(): number
}

export const useTableStore = create<TableStore>((set, get) => ({
  currentSession: null,
  tableNumber: null,
  cartItems: [],
  isSessionLoading: false,

  initSession: (tableNumber: string) => {
    set({ tableNumber })
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        try {
          const session: TableSessionState = JSON.parse(stored)
          if (session.tableNumber === tableNumber) {
            set({ currentSession: session })
          }
        } catch (e) {
          localStorage.removeItem(SESSION_KEY)
        }
      }
    }
  },

  checkTableStatus: async (tableNumber: string) => {
    set({ isSessionLoading: true })
    try {
      // Pass stored session token so the server can verify ownership
      // Without it, the server returns only the bare "occupied" signal (security fix)
      let tokenParam = ''
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(SESSION_KEY)
        if (stored) {
          try {
            const session: TableSessionState = JSON.parse(stored)
            if (session.tableNumber === tableNumber && session.sessionToken) {
              tokenParam = `&token=${encodeURIComponent(session.sessionToken)}`
            }
          } catch {}
        }
      }

      const res = await fetch(`/api/table/check-lock?table=${tableNumber}${tokenParam}`)
      const data = await res.json()
      set({ isSessionLoading: false })

      if (data.locked) {
        return { locked: true, session: data }
      }
      return { locked: false, session: null }
    } catch (e) {
      set({ isSessionLoading: false })
      return { locked: false, session: null }
    }
  },

  placeFirstOrder: async (tableNumber: string, items: CartItem[], notes?: string) => {
    set({ isSessionLoading: true })
    try {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const gst = Math.round(subtotal * 0.05 * 100) / 100 // 5% GST
      const total = subtotal + gst

      const res = await fetch('/api/table/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          firstOrder: {
            items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            subtotal,
            gst,
            total,
            notes
          }
        })
      })

      const data = await res.json()
      set({ isSessionLoading: false })

      if (data.success) {
        const session: TableSessionState = {
          sessionId: data.sessionId,
          sessionToken: data.sessionToken,
          tableNumber,
          status: 'active',
          totalAmount: total,
          roundCount: 1,
          startedAt: new Date().toISOString()
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        }

        set({ currentSession: session, cartItems: [] })
        toast.success(`Order placed! KOT: ${data.kotNumber}`)
        return true
      } else {
        toast.error(data.message || 'Failed to place order')
        return false
      }
    } catch (e) {
      set({ isSessionLoading: false })
      toast.error('Connection error. Please try again.')
      return false
    }
  },

  addMoreItems: async (notes?: string) => {
    const session = get().currentSession
    const items = get().cartItems
    if (!session || items.length === 0) return false

    set({ isSessionLoading: true })
    try {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const gst = Math.round(subtotal * 0.05 * 100) / 100 // 5% GST
      const total = subtotal + gst

      const res = await fetch('/api/table/add-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
          tableNumber: session.tableNumber,
          items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
          subtotal,
          gst,
          total,
          notes
        })
      })

      const data = await res.json()
      set({ isSessionLoading: false })

      if (data.success) {
        const updatedSession: TableSessionState = {
          ...session,
          totalAmount: data.newSessionTotal,
          roundCount: data.roundNumber
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession))
        }

        set({ currentSession: updatedSession, cartItems: [] })
        toast.success(`Round ${data.roundNumber} placed! KOT: ${data.kotNumber}`)
        return true
      } else {
        toast.error(data.message || 'Failed to add items')
        return false
      }
    } catch (e) {
      set({ isSessionLoading: false })
      toast.error('Connection error. Please try again.')
      return false
    }
  },

  completeOrder: async () => {
    const session = get().currentSession
    if (!session) return false

    set({ isSessionLoading: true })
    try {
      const res = await fetch('/api/table/complete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionToken: session.sessionToken
        })
      })

      const data = await res.json()
      set({ isSessionLoading: false })

      if (data.success) {
        const updatedSession: TableSessionState = {
          ...session,
          status: 'payment_pending'
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession))
        }

        set({ currentSession: updatedSession })
        toast.success('Bill requested! Please complete payment.')
        return true
      } else {
        toast.error(data.message || 'Failed to request bill')
        return false
      }
    } catch (e) {
      set({ isSessionLoading: false })
      toast.error('Connection error')
      return false
    }
  },

  clearTableSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY)
    }
    set({ currentSession: null, cartItems: [] })
  },

  // Cart actions
  addToCart: (item: MenuItem) => {
    const currentItems = get().cartItems
    const existing = currentItems.find(i => i.id === item.id)

    if (existing) {
      set({
        cartItems: currentItems.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    } else {
      set({ cartItems: [...currentItems, { ...item, quantity: 1 }] })
    }

    toast.success(`${item.name} added to cart`, {
      style: {
        border: '1px solid #F0F0F0',
        padding: '12px 16px',
        color: '#1A1A1A',
        background: '#FFFFFF',
        fontFamily: 'var(--font-brand), sans-serif',
        fontSize: '13px',
        fontWeight: 600,
      },
      iconTheme: {
        primary: '#CC0000',
        secondary: '#FFFFFF',
      },
    })
  },

  removeFromCart: (id: string) => {
    set({ cartItems: get().cartItems.filter(i => i.id !== id) })
  },

  updateCartQuantity: (id: string, delta: number) => {
    const currentItems = get().cartItems
    const target = currentItems.find(i => i.id === id)
    if (!target) return

    const newQty = target.quantity + delta
    if (newQty <= 0) {
      get().removeFromCart(id)
    } else {
      set({
        cartItems: currentItems.map(i =>
          i.id === id ? { ...i, quantity: newQty } : i
        ),
      })
    }
  },

  clearCart: () => {
    set({ cartItems: [] })
  },

  // Helpers
  hasSessionToken: (tableNumber: string) => {
    const session = get().currentSession
    return session !== null && session.tableNumber === tableNumber && !!session.sessionToken
  },

  getCartTotal: () => {
    return get().cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  getCartItemCount: () => {
    return get().cartItems.reduce((sum, item) => sum + item.quantity, 0)
  }
}))
