'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, HelpCircle, User, Menu } from 'lucide-react'
import { useOrderStore } from '@/store/orderStore'
import AdminModal from '../shared/AdminModal'

export default function AdminTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  const orders = useOrderStore(state => state.orders)

  const [time, setTime] = useState('')
  const [hasUnread, setHasUnread] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Live Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 30000)
    return () => clearInterval(timer)
  }, [])

  // Check Unread Status
  useEffect(() => {
    const unread = orders.some(o => !o.seenByAdmin && o.status === 'placed')
    setHasUnread(unread)
  }, [orders])

  const getPageTitle = () => {
    const segment = pathname.split('/').pop() || ''
    switch (segment) {
      case 'dashboard':
        return 'Dashboard'
      case 'orders':
        return 'Orders'
      case 'bills':
        return 'Invoices & Bills'
      case 'products':
        return 'Menu Products'
      case 'agents':
        return 'Delivery Agents'
      case 'coupons':
        return 'Offers & Coupons'
      case 'settings':
        return 'Settings'
      default:
        if (pathname.includes('/orders/')) return 'Order Details'
        return 'Admin Portal'
    }
  }

  return (
    <>
      <header className="h-16 bg-white border-b border-brand-border px-5 md:px-8 flex items-center justify-between flex-shrink-0 z-30">
        {/* Left hamburger + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-admin-sidebar'))}
            className="lg:hidden p-1.5 -ml-1 text-brand-body hover:text-brand-red hover:bg-brand-surface rounded-btn transition-colors cursor-pointer"
            title="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-brand font-black text-[18px] md:text-[20px] text-brand-black tracking-tight whitespace-nowrap">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-5">
          {/* Live clock */}
          <span className="font-body text-[13px] text-brand-body hidden sm:inline-block">
            {time}
          </span>

          {/* Cheatsheet trigger */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="text-brand-muted hover:text-brand-red transition-colors p-1"
            title="Keyboard Shortcuts"
          >
            <HelpCircle size={18} />
          </button>

          {/* Notification bell */}
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="relative p-1 text-brand-muted hover:text-brand-red transition-colors"
          >
            <Bell size={18} />
            {hasUnread && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-brand-red rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Profile badge chip */}
          <div className="flex items-center gap-2 bg-brand-redLight rounded-pill px-3 py-1.5 border border-[rgba(204,0,0,0.08)]">
            <div className="w-6 h-6 rounded-full bg-brand-red flex items-center justify-center text-white">
              <User size={12} />
            </div>
            <span className="font-brand font-bold text-[11px] text-brand-red uppercase tracking-[0.5px]">
              Admin
            </span>
          </div>
        </div>
      </header>

      {/* Cheatsheet Modal */}
      <AdminModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Cheatsheet — Keyboard Shortcuts"
        size="sm"
      >
        <div className="space-y-4 font-body text-[13px] text-brand-black leading-relaxed">
          <p className="text-brand-muted mb-2">Navigate between sections quickly using these shortcuts:</p>
          <div className="grid grid-cols-2 gap-2 border-t border-brand-border pt-3">
            <span className="font-semibold text-brand-muted uppercase">Shortcut</span>
            <span className="font-semibold text-brand-muted uppercase">Destination</span>

            <span><kbd className="px-1.5 py-0.5 bg-brand-surface border rounded font-mono text-[11px]">Alt + D</kbd></span>
            <span>Dashboard</span>

            <span><kbd className="px-1.5 py-0.5 bg-brand-surface border rounded font-mono text-[11px]">Alt + O</kbd></span>
            <span>Orders</span>

            <span><kbd className="px-1.5 py-0.5 bg-brand-surface border rounded font-mono text-[11px]">Alt + P</kbd></span>
            <span>Products</span>

            <span><kbd className="px-1.5 py-0.5 bg-brand-surface border rounded font-mono text-[11px]">Alt + S</kbd></span>
            <span>Settings</span>

            <span><kbd className="px-1.5 py-0.5 bg-brand-surface border rounded font-mono text-[11px]">Escape</kbd></span>
            <span>Close Open Modal</span>
          </div>
        </div>
      </AdminModal>
    </>
  )
}
