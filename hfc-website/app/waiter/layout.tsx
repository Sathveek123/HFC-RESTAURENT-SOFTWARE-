'use client'

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useWaiterStore } from '@/store/waiterStore'
import WaiterTopbar from '@/components/waiter/WaiterTopbar'

function WaiterAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isAuthenticated = useWaiterStore(state => state.isAuthenticated)
  const checkSession = useWaiterStore(state => state.checkSession)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (pathname === '/waiter/login') return
    if (!isAuthenticated) {
      router.replace('/waiter/login')
    }
  }, [isAuthenticated, pathname, router])

  if (!isAuthenticated && pathname !== '/waiter/login') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-body text-[13px] text-brand-muted">
        Checking waiter session...
      </div>
    )
  }

  return <>{children}</>
}

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/waiter/login'

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#FAFAFA]">{children}</main>
  }

  return (
    <WaiterAuthGuard>
      <div className="flex flex-col min-h-screen bg-[#FAFAFA]">
        <WaiterTopbar />
        <main className="flex-1 max-w-[480px] w-full mx-auto relative">{children}</main>
      </div>
    </WaiterAuthGuard>
  )
}
