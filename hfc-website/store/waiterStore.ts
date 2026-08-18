import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const SESSION_KEY = 'hfc-waiter-session'

export interface Waiter {
  id: string
  name: string
  assignedTables: string[] | null
}

interface WaiterStore {
  waiter: Waiter | null
  isAuthenticated: boolean
  activeOrders: any[]
  isLoading: boolean

  // Session Actions
  login: (staffId: string, pin: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  checkSession: () => void

  // Orders Actions
  fetchActiveOrders: () => Promise<void>
  acceptOrder: (orderId: string) => Promise<{ success: boolean; error?: string; kotNumber?: string }>
  rejectOrder: (orderId: string, reason: string) => Promise<{ success: boolean; error?: string }>
  markServed: (orderId: string) => Promise<{ success: boolean; error?: string }>
  setOrders: (orders: any[]) => void
}

export const useWaiterStore = create<WaiterStore>((set, get) => ({
  waiter: null,
  isAuthenticated: false,
  activeOrders: [],
  isLoading: false,

  login: async (staffId: string, pin: string) => {
    set({ isLoading: true })
    try {
      // 1. Verify PIN via SECURE RPC function
      const { data, error } = await supabase.rpc('verify_waiter_pin', {
        p_staff_id: staffId,
        p_pin: pin
      })

      if (error) throw error

      if (data === true) {
        // 2. Fetch waiter info from waiters table
        const { data: waiterData, error: waiterErr } = await supabase
          .from('waiters')
          .select('id, name, assigned_tables')
          .eq('id', staffId)
          .single()

        if (waiterErr || !waiterData) {
          throw new Error(waiterErr?.message || 'Failed to fetch waiter profile')
        }

        const sessionUser: Waiter = {
          id: waiterData.id,
          name: waiterData.name,
          assignedTables: waiterData.assigned_tables || null
        }

        // Store session in sessionStorage (force shift re-login)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
        }

        set({ waiter: sessionUser, isAuthenticated: true, isLoading: false })
        toast.success(`Welcome back, ${sessionUser.name}!`)
        return { success: true }
      } else {
        set({ isLoading: false })
        return { success: false, error: 'Incorrect PIN code' }
      }
    } catch (err: any) {
      set({ isLoading: false })
      console.error('Waiter verification failed:', err)
      return { success: false, error: err.message || 'Verification failed' }
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY)
    }
    set({ waiter: null, isAuthenticated: false, activeOrders: [] })
    toast.success('Logged out successfully.')
  },

  checkSession: () => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        try {
          const sessionUser: Waiter = JSON.parse(stored)
          set({ waiter: sessionUser, isAuthenticated: true })
        } catch (e) {
          sessionStorage.removeItem(SESSION_KEY)
        }
      }
    }
  },

  fetchActiveOrders: async () => {
    const waiter = get().waiter
    if (!waiter) return

    set({ isLoading: true })
    try {
      let query = supabase
        .from('table_orders')
        .select('*')
        .in('status', ['placed', 'accepted', 'ready', 'served'])
        .order('placed_at', { ascending: false })

      // Scoped view RLS-alike check: filter tables locally if assignedTables is set
      if (waiter.assignedTables && waiter.assignedTables.length > 0) {
        query = query.in('table_number', waiter.assignedTables)
      }

      const { data, error } = await query
      if (error) throw error

      set({ activeOrders: data || [], isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      console.error('Failed to fetch active orders:', err)
    }
  },

  acceptOrder: async (orderId: string) => {
    const waiter = get().waiter
    if (!waiter) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch('/api/waiter/accept-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          waiterId: waiter.id,
          waiterName: waiter.name,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.message || data.error || 'Failed to accept order' }
      }

      toast.success(`Order accepted! KOT: ${data.kotNumber}`)
      get().fetchActiveOrders() // refresh list
      return { success: true, kotNumber: data.kotNumber }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' }
    }
  },

  rejectOrder: async (orderId: string, reason: string) => {
    const waiter = get().waiter
    if (!waiter) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch('/api/waiter/reject-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          waiterId: waiter.id,
          reason,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.message || data.error || 'Failed to reject order' }
      }

      toast.success('Order rejected successfully.')
      get().fetchActiveOrders()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' }
    }
  },

  markServed: async (orderId: string) => {
    const waiter = get().waiter
    if (!waiter) return { success: false, error: 'Not authenticated' }

    try {
      const res = await fetch('/api/waiter/mark-served', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          waiterId: waiter.id,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.message || data.error || 'Failed to mark served' }
      }

      toast.success('Order marked as served!')
      get().fetchActiveOrders()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' }
    }
  },

  setOrders: (orders: any[]) => {
    set({ activeOrders: orders })
  }
}))
