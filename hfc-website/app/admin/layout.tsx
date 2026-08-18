'use client'

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from '@/components/admin/layout/AdminSidebar'
import AdminTopbar from '@/components/admin/layout/AdminTopbar'
import AdminAuthGuard from '@/components/admin/layout/AdminAuthGuard'
import { useOrderStore } from '@/store/orderStore'
import { useSettingsStore } from '@/store/settingsStore'
import toast from 'react-hot-toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AdminOfflineFallback from '@/components/admin/layout/AdminOfflineFallback'


import { subscribeToAllOrdersRealtime, fetchOrdersFromSupabase } from '@/lib/supabaseSync'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const orders = useOrderStore(state => state.orders)
  const settings = useSettingsStore(state => state.settings)

  // 1. Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault()
            router.push('/admin/dashboard')
            break
          case 'o':
            e.preventDefault()
            router.push('/admin/orders')
            break
          case 'p':
            e.preventDefault()
            router.push('/admin/products')
            break
          case 's':
            e.preventDefault()
            router.push('/admin/settings')
            break
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  // 2. Play Notification Sound via Web Audio API (High-Fidelity double-tone bell chime)
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      
      // Tone 1: D5 (587.33Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime)
      gain1.gain.setValueAtTime(0.3, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.3)

      // Tone 2: A5 (880.00Hz) slightly delayed
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator()
          const gain2 = ctx.createGain()
          osc2.connect(gain2)
          gain2.connect(ctx.destination)
          osc2.frequency.setValueAtTime(880.00, ctx.currentTime)
          gain2.gain.setValueAtTime(0.3, ctx.currentTime)
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
          osc2.start(ctx.currentTime)
          osc2.stop(ctx.currentTime + 0.6)
        } catch (err) {
          // ignore potential audio state failures in background context
        }
      }, 120)
    } catch (e) {
      console.warn('Web Audio Context blocked or not supported by browser:', e)
    }
  }

  // 3. New Orders Realtime Subscriber (WebSockets)
  useEffect(() => {
    if (pathname === '/admin/login') return

    // Hydro-fetch initial orders to hydrate layout cache
    fetchOrdersFromSupabase().then(fetched => {
      if (fetched && fetched.length > 0) {
        useOrderStore.getState().upsertOrders(fetched)
      }
    })

    const unsubscribe = subscribeToAllOrdersRealtime((updatedOrder) => {
      // Check if it's a brand new order (status === 'placed' and not already in store)
      const exists = useOrderStore.getState().orders.some(o => o.id === updatedOrder.id)
      if (!exists && updatedOrder.status === 'placed') {
        playChime()
        let notifyTitle = '🔔 New Order Received!'
        let notifyBody = `Customer: ${updatedOrder.customerName} (₹${updatedOrder.total.toLocaleString('en-IN')})`
        
        if (updatedOrder.source === 'counter-qr') {
          notifyTitle = `🥡 COUNTER ORDER — Token #${updatedOrder.tokenNumber || ''}`
          notifyBody = `${updatedOrder.items.length} items · ₹${updatedOrder.total.toLocaleString('en-IN')} · Payment: UPI`
        }

        toast.success(
          (t) => (
            <div className="flex flex-col gap-1 font-body text-[13px]">
              <strong className="font-brand font-bold text-brand-black">
                {notifyTitle}
              </strong>
              <span>
                {notifyBody}
              </span>
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  router.push(`/admin/orders/${updatedOrder.id}`)
                }}
                className="text-brand-red font-semibold text-left underline mt-1"
              >
                View Order →
              </button>
            </div>
          ),
          { duration: 8000 }
        )
      }

      // Upsert order globally
      useOrderStore.getState().upsertOrder(updatedOrder)
    })

    return () => unsubscribe()
  }, [pathname, router])

  const isLoginPage = pathname === '/admin/login'

  return (
    <AdminAuthGuard>
      {isLoginPage ? (
        <div className="min-h-screen bg-brand-surface">{children}</div>
      ) : (
        <div className="flex flex-row h-screen overflow-hidden bg-brand-surface">
          {/* Sidebar Navigation */}
          <AdminSidebar />

          {/* Right Core Content Area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <AdminTopbar />
            <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#FAFAFA]">
              <ErrorBoundary fallback={<AdminOfflineFallback />}>
                {children}
              </ErrorBoundary>
            </main>
          </div>
        </div>
      )}
    </AdminAuthGuard>

  )
}
