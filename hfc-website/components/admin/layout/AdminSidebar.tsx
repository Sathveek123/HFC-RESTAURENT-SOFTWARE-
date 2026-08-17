'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  UtensilsCrossed,
  ChefHat,
  Truck,
  Tag,
  Settings,
  LogOut,
  X,
  Package,
  LayoutGrid
} from 'lucide-react'
import Image from 'next/image'
import { useAdminAuthStore } from '@/store/adminAuthStore'
import { useOrderStore } from '@/store/orderStore'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAdminAuthStore(state => state.logout)
  const orders = useOrderStore(state => state.orders)

  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTablesCount, setActiveTablesCount] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchActiveCount = async () => {
      const { count } = await supabase
        .from('table_sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'payment_pending'])
      
      setActiveTablesCount(count || 0)
    }
    fetchActiveCount()

    const channel = supabase
      .channel('sidebar-tables-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => {
        fetchActiveCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Listen for hamburger toggle event
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    window.addEventListener('toggle-admin-sidebar', handleToggle)
    return () => window.removeEventListener('toggle-admin-sidebar', handleToggle)
  }, [])

  // Auto-close mobile sidebar when path changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const newOrdersCount = mounted ? orders.filter(o => !o.seenByAdmin && o.status === 'placed').length : 0
  const pendingOrdersCount = mounted ? orders.filter(o => o.status === 'placed').length : 0
  const kitchenOrdersCount = mounted ? orders.filter(o => o.status === 'accepted').length : 0

  const handleLogout = () => {
    logout()
    router.push('/admin/login')
  }

  const navItems = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      badge: newOrdersCount > 0 ? newOrdersCount : undefined,
    },
    {
      label: 'Orders',
      href: '/admin/orders',
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      label: 'Kitchen View',
      href: '/admin/kitchen',
      icon: ChefHat,
      badge: kitchenOrdersCount > 0 ? kitchenOrdersCount : undefined,
    },
    {
      label: 'Tables',
      href: '/admin/tables',
      icon: LayoutGrid,
      badge: activeTablesCount > 0 ? activeTablesCount : undefined,
    },
    {
      label: 'Bills',
      href: '/admin/bills',
      icon: Receipt,
    },
    {
      label: 'Products',
      href: '/admin/products',
      icon: UtensilsCrossed,
    },
    {
      label: 'Inventory',
      href: '/admin/inventory',
      icon: Package,
    },
    {
      label: 'Delivery Agents',
      href: '/admin/agents',
      icon: Truck,
    },
    {
      label: 'Offers & Coupons',
      href: '/admin/coupons',
      icon: Tag,
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: Settings,
    },
  ]

  const renderSidebarContent = () => (
    <>
      {/* Top Brand Section */}
      <div className="p-6 border-b border-brand-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-border flex-shrink-0">
            <Image
              src="/logo.jpeg"
              alt="HFC Logo"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-brand font-black text-[20px] text-brand-red tracking-tight">HFC</span>
            <span className="font-brand font-semibold text-[9px] text-brand-muted tracking-[2px] uppercase mt-0.5">
              Admin Panel
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-1.5 text-brand-muted hover:text-brand-black transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-hide">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-btn cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-redLight text-brand-red'
                    : 'text-brand-body hover:bg-brand-surface hover:text-brand-black'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={`font-brand text-[13.5px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {item.badge !== undefined && (
                  <span className="ml-auto bg-brand-red text-white text-[10px] font-brand font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Logout Section */}
      <div className="p-4 border-t border-brand-border bg-white flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-brand-body hover:text-red-600 w-full rounded-btn hover:bg-red-50 transition-all text-left cursor-pointer"
        >
          <LogOut size={18} />
          <span className="font-brand font-medium text-[13.5px]">Sign Out</span>
        </button>
        <p className="text-center font-body text-[10px] text-brand-muted mt-3">
          Logged in as <span className="font-semibold text-brand-black">hfc_admin</span>
        </p>
      </div>
    </>
  )

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="w-[260px] h-screen bg-white border-r border-brand-border flex-col flex-shrink-0 sticky top-0 hidden lg:flex">
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile Drawer Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
          />

          {/* Drawer Sidebar Content */}
          <aside className="relative w-[260px] h-full bg-white flex flex-col z-10 shadow-2xl animate-slide-right">
            {renderSidebarContent()}
          </aside>
        </div>
      )}
    </>
  )
}
