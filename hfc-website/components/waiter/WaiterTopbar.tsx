'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useWaiterStore } from '@/store/waiterStore'
import { LogOut } from 'lucide-react'
import Image from 'next/image'

export default function WaiterTopbar() {
  const router = useRouter()
  const waiter = useWaiterStore(state => state.waiter)
  const logout = useWaiterStore(state => state.logout)

  const handleLogout = () => {
    logout()
    router.replace('/waiter/login')
  }

  const initials = waiter ? waiter.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'WT'
  const firstName = waiter ? waiter.name.split(' ')[0] : 'Waiter'

  return (
    <header className="bg-white border-b border-brand-border sticky top-0 z-30 shadow-xs">
      <div className="flex items-center justify-between px-4 py-3 max-w-[480px] w-full mx-auto">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.jpeg"
            width={32}
            height={32}
            className="rounded-full border border-brand-border object-contain"
            alt="HFC Logo"
          />
          <span className="font-brand font-black text-[16px] text-brand-red tracking-tight">HFC</span>
          <span className="font-brand font-semibold text-[11px] uppercase tracking-wide text-brand-muted bg-brand-surface border border-brand-border px-2 py-0.5 rounded-full">
            Waiter Stand
          </span>
        </div>

        {waiter && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-full bg-brand-redLight flex items-center justify-center text-brand-red font-brand font-bold text-[11px]">
                {initials}
              </div>
              <span className="font-brand font-semibold text-[13px] text-brand-black">
                {firstName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-brand-muted hover:text-brand-red transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
