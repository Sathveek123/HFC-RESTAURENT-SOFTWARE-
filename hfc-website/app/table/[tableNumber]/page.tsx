'use client'

import React, { use, useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { UtensilsCrossed, CheckCircle2, ChevronLeft, HelpCircle } from 'lucide-react'
import { useTableStore } from '@/store/tableStore'
import { useSettingsStore } from '@/store/settingsStore'
import { supabase } from '@/lib/supabase'

import TableMenuBrowser from '@/components/table/TableMenuBrowser'
import TableCart from '@/components/table/TableCart'
import TableSessionLock from '@/components/table/TableSessionLock'
import TableOrderTracker from '@/components/table/TableOrderTracker'
import TablePaymentBlock from '@/components/table/TablePaymentBlock'
import TableOrderSummary from '@/components/table/TableOrderSummary'

interface TablePageProps {
  params: Promise<{ tableNumber: string }>
}

export default function TableOrderingPage({ params }: TablePageProps) {
  const { tableNumber } = use(params)
  const router = useRouter()

  const initSession = useTableStore(state => state.initSession)
  const checkTableStatus = useTableStore(state => state.checkTableStatus)
  const hasSessionToken = useTableStore(state => state.hasSessionToken)
  const currentSession = useTableStore(state => state.currentSession)
  const clearTableSession = useTableStore(state => state.clearTableSession)

  const fetchAndSyncSettings = useSettingsStore(state => state.fetchAndSyncSettings)

  // Local view states
  const [dbLocked, setDbLocked] = useState(false)
  const [dbSession, setDbSession] = useState<any | null>(null)
  const [checkingDb, setCheckingDb] = useState(true)
  
  // Toggles inside ordering state
  const [showMenu, setShowMenu] = useState(false)
  const [readOnlyViewOrder, setReadOnlyViewOrder] = useState(false)

  // 1. Init settings and session tokens
  useEffect(() => {
    fetchAndSyncSettings()
    initSession(tableNumber)
  }, [tableNumber, initSession, fetchAndSyncSettings])

  // 2. Fetch initial active session status from Database
  const fetchLockStatus = async () => {
    const status = await checkTableStatus(tableNumber)
    if (status.locked && status.session) {
      setDbLocked(true)
      setDbSession(status.session)
    } else {
      setDbLocked(false)
      setDbSession(null)
      // If table is free in DB but we had a session token stored locally, clear it!
      clearTableSession()
    }
    setCheckingDb(false)
  }

  useEffect(() => {
    fetchLockStatus()

    // 3. Realtime subscription to session changes for this table
    const channel = supabase
      .channel(`table-lock-realtime-${tableNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `table_number=eq.${tableNumber}`
        },
        (payload) => {
          // If a session gets updated or inserted
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newSession = payload.new
            if (newSession.status === 'active' || newSession.status === 'payment_pending') {
              setDbLocked(true)
              setDbSession(newSession)
            } else if (newSession.status === 'completed' || newSession.status === 'released') {
              // Table released!
              setDbLocked(false)
              setDbSession(null)
              clearTableSession()
            }
          } else if (payload.eventType === 'DELETE') {
            setDbLocked(false)
            setDbSession(null)
            clearTableSession()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableNumber])

  // Helper: check if device matches the DB session
  const ownsActiveSession = hasSessionToken(tableNumber) && currentSession && dbSession && currentSession.sessionId === dbSession.sessionId

  // Render Loader
  if (checkingDb) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="font-brand font-semibold text-[13px] text-brand-muted mt-4">Connecting to Table {tableNumber}...</p>
      </div>
    )
  }

  // --- STATE 5: PAYMENT COMPLETE / TABLE RELEASED ---
  // (Handled via real-time update when dbLocked is set to false)

  // --- STATE 4: PAYMENT PENDING ---
  if (dbLocked && dbSession && dbSession.status === 'payment_pending') {
    if (ownsActiveSession) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] pb-12">
          {renderHeader(true)}
          <div className="max-w-md mx-auto p-4 space-y-6">
            <TablePaymentBlock
              sessionId={dbSession.sessionId || dbSession.id}
              totalAmount={Number(dbSession.totalAmount || dbSession.total_amount) || 0}
              tableNumber={tableNumber}
              onPaymentNotified={() => {}}
            />
            <TableOrderSummary sessionId={dbSession.sessionId || dbSession.id} tableNumber={tableNumber} />
          </div>
        </div>
      )
    } else {
      // Locked by another device, and they requested checkout
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
          {renderHeader(false)}
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-100">
            <UtensilsCrossed className="text-amber-600" size={24} />
          </div>
          <h2 className="font-display font-extrabold text-[22px] text-brand-black">Table Awaiting Payment</h2>
          <p className="font-body text-[14px] text-brand-muted mt-2 max-w-[280px]">
            The bill is being settled for this table. Once payment is confirmed, the table will be released.
          </p>
        </div>
      )
    }
  }

  // --- STATE 3: TABLE LOCKED — OTHER DEVICE ---
  if (dbLocked && dbSession && !ownsActiveSession) {
    if (readOnlyViewOrder) {
      return (
        <div className="min-h-screen bg-[#FAFAFA]">
          {/* Header with back button */}
          <div className="sticky top-0 z-50 bg-white border-b border-brand-border px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setReadOnlyViewOrder(false)}
              className="flex items-center gap-1 text-[13px] font-brand font-bold text-brand-body hover:text-brand-black cursor-pointer"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <span className="font-brand font-bold text-[14px] text-brand-black">Table {tableNumber} Bill</span>
            <div className="w-8" />
          </div>
          <div className="max-w-md mx-auto p-4 space-y-4">
            <TableOrderSummary sessionId={dbSession.sessionId || dbSession.id} tableNumber={tableNumber} />
            <TableOrderTracker
              sessionId={dbSession.sessionId || dbSession.id}
              tableNumber={tableNumber}
              onAddMore={() => {}}
              onCheckout={() => {}}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white">
        {renderHeader(false)}
        <TableSessionLock
          tableNumber={tableNumber}
          currentSessionTotal={Number(dbSession.totalAmount || dbSession.total_amount) || 0}
          roundCount={Number(dbSession.roundCount) || 1}
          onViewOrder={() => setReadOnlyViewOrder(true)}
        />
      </div>
    )
  }

  // --- STATE 2: ACTIVE ORDER ROUNDS TRACKER ---
  if (dbLocked && ownsActiveSession && !showMenu) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        {renderHeader(true)}
        <TableOrderTracker
          sessionId={currentSession.sessionId}
          tableNumber={tableNumber}
          onAddMore={() => setShowMenu(true)}
          onCheckout={async () => {
            await useTableStore.getState().completeOrder()
          }}
        />
      </div>
    )
  }

  // --- STATE 1: TABLE FREE & BROWSE MENU ---
  return (
    <div className="min-h-screen bg-white">
      {renderHeader(ownsActiveSession)}
      {ownsActiveSession && (
        <div className="bg-brand-redLight px-4 py-2.5 flex items-center justify-between border-b border-brand-red/10 animate-fade-in">
          <span className="text-[12.5px] font-body font-semibold text-brand-red">
            Adding items to active session
          </span>
          <button
            onClick={() => setShowMenu(false)}
            className="text-[12px] font-brand font-bold text-brand-red hover:underline cursor-pointer"
          >
            View Placed Order (₹{Number(dbSession?.total_amount || 0).toFixed(0)}) ➜
          </button>
        </div>
      )}
      <TableMenuBrowser />
      <TableCart
        tableNumber={tableNumber}
        isFirstOrder={!ownsActiveSession}
        onSuccess={() => setShowMenu(false)}
      />
    </div>
  )

  // Header render helper
  function renderHeader(hasActive: boolean) {
    return (
      <div className="sticky top-0 z-50 bg-white border-b border-brand-border shadow-xs">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image src="/logo.jpeg" width={32} height={32} className="rounded-full border border-brand-border" alt="HFC Logo" />
            <span className="font-brand font-black text-[15px] text-brand-red tracking-tight">HFC</span>
          </div>

          {/* Table Badge */}
          <div className="flex items-center gap-1.5 bg-brand-red text-white rounded-full px-3.5 py-1">
            <UtensilsCrossed size={12} />
            <span className="font-brand font-bold text-[12.5px]">Table {tableNumber}</span>
          </div>

          {/* Active status */}
          {hasActive ? (
            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="font-brand font-bold text-[10px] text-green-700 uppercase">Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
              <span className="font-brand font-bold text-[10px] text-brand-muted uppercase">Dine-in</span>
            </div>
          )}
        </div>
      </div>
    )
  }
}
