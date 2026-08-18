'use client'

import React, { use, useState, useEffect } from 'react'
import Image from 'next/image'
import { UtensilsCrossed, Lock } from 'lucide-react'
import { useTableStore } from '@/store/tableStore'
import { useSettingsStore } from '@/store/settingsStore'
import { supabase } from '@/lib/supabase'

import TableMenuBrowser from '@/components/table/TableMenuBrowser'
import TableCart from '@/components/table/TableCart'
import TableSessionLock from '@/components/table/TableSessionLock'
import TableOrderTracker from '@/components/table/TableOrderTracker'
import TablePaymentBlock from '@/components/table/TablePaymentBlock'
import TableOrderSummary from '@/components/table/TableOrderSummary'

// ─── sessionStorage key for device-binding (Layer 2 guard) ───────────────────
const ACTIVE_TABLE_CONTEXT_KEY = 'hfc-active-table-context'

interface TablePageProps {
  params: Promise<{ tableNumber: string }>
}

export default function TableOrderingPage({ params }: TablePageProps) {
  const { tableNumber } = use(params)

  const initSession = useTableStore(state => state.initSession)
  const checkTableStatus = useTableStore(state => state.checkTableStatus)
  const hasSessionToken = useTableStore(state => state.hasSessionToken)
  const currentSession = useTableStore(state => state.currentSession)
  const clearTableSession = useTableStore(state => state.clearTableSession)

  const fetchAndSyncSettings = useSettingsStore(state => state.fetchAndSyncSettings)

  // Page states
  const [dbLocked, setDbLocked] = useState(false)
  const [dbSession, setDbSession] = useState<any | null>(null)
  const [checkingDb, setCheckingDb] = useState(true)
  const [wrongTableBlocked, setWrongTableBlocked] = useState(false)

  // Toggles inside ordering state
  const [showMenu, setShowMenu] = useState(false)

  // ─── LAYER 2: Client-side device binding guard ───────────────────────────────
  // On FIRST visit to /table/X, bind this device to table X for this browser session.
  // On subsequent navigation within the same tab, only allow the originally bound table.
  // Uses sessionStorage (not localStorage) — resets when tab is closed.
  function checkDeviceBinding(): boolean {
    if (typeof window === 'undefined') return true
    const boundTable = sessionStorage.getItem(ACTIVE_TABLE_CONTEXT_KEY)
    if (!boundTable) {
      // First table this session — bind and allow
      sessionStorage.setItem(ACTIVE_TABLE_CONTEXT_KEY, tableNumber)
      return true
    }
    // Already bound to a different table in this session — block!
    return boundTable === tableNumber
  }

  // ─── CORE MOUNT: Resume session or fresh check ────────────────────────────────
  const fetchLockStatus = async () => {
    const status = await checkTableStatus(tableNumber)

    if (status.locked && status.session) {
      // FIX 1: If the API returns isOwner=true, the stored session token was validated
      // server-side — this is their order, restore the active tracker UI
      if (status.session.isOwner) {
        setDbLocked(true)
        setDbSession(status.session)
      } else {
        // Locked by someone else — show bare "occupied" state (no order details)
        setDbLocked(true)
        setDbSession({ ...status.session, isOwner: false })
        // Their stored token (if any) doesn't match — clear it
        clearTableSession()
      }
    } else {
      // Table is free
      setDbLocked(false)
      setDbSession(null)
      // If DB says table is free but we had a local session token, it was stale — clear it
      clearTableSession()
    }
    setCheckingDb(false)
  }

  useEffect(() => {
    // ─── Layer 2 guard ───────────────────────────────────────────────────────
    if (!checkDeviceBinding()) {
      setWrongTableBlocked(true)
      setCheckingDb(false)
      return
    }

    // ─── Settings + session init ─────────────────────────────────────────────
    fetchAndSyncSettings()
    initSession(tableNumber)

    // ─── FIX 1: Mandatory DB fetch on EVERY mount ─────────────────────────────
    // Never trust stale in-memory state from before navigation.
    // The stored session token is the source of truth for ownership,
    // but the actual bill data must always come from a live DB re-fetch.
    fetchLockStatus()

    // ─── Realtime subscription to session changes for this table ─────────────
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
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newSession = payload.new
            if (newSession.status === 'active' || newSession.status === 'payment_pending') {
              // Re-fetch with owner check to get the correct visibility tier
              await fetchLockStatus()
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

  // True owner = API confirmed isOwner AND local store has matching session
  const ownsActiveSession = dbSession?.isOwner === true && hasSessionToken(tableNumber) && currentSession?.sessionId === dbSession?.sessionId

  // Render Loader
  if (checkingDb) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="font-brand font-semibold text-[13px] text-brand-muted mt-4">Connecting to Table {tableNumber}...</p>
      </div>
    )
  }

  // ─── BLOCKED: Wrong table for this device in this session ────────────────────
  if (wrongTableBlocked) {
    const boundTable = typeof window !== 'undefined'
      ? sessionStorage.getItem(ACTIVE_TABLE_CONTEXT_KEY)
      : null
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-sm">
          <Lock size={36} className="text-amber-500" />
        </div>
        <h2 className="font-display font-bold text-[24px] text-brand-black mb-2">Wrong Table</h2>
        <p className="font-body text-[14px] text-brand-muted max-w-[280px] leading-relaxed mb-6">
          Your device is active on <strong>Table {boundTable}</strong> in this session. You can only view and add to your own table's order.
        </p>
        <p className="font-body text-[11px] text-brand-muted">
          Please scan the QR code at your table, or ask staff for assistance.
        </p>
      </div>
    )
  }

  // ─── STATE 4: PAYMENT PENDING ────────────────────────────────────────────────
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
      // Stranger — table awaiting payment, no details shown
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          {renderHeader(false)}
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100 shadow-sm">
            <Lock size={36} className="text-brand-red" />
          </div>
          <h2 className="font-display font-bold text-[24px] text-brand-black mb-2">Table {tableNumber} is Occupied</h2>
          <p className="font-body text-[14px] text-brand-muted max-w-[280px] leading-relaxed">
            This table currently has guests seated. Please check your own table's QR code, or ask staff for assistance.
          </p>
        </div>
      )
    }
  }

  // ─── STATE 3: TABLE LOCKED — STRANGER DEVICE ─────────────────────────────────
  if (dbLocked && !ownsActiveSession) {
    return (
      <div className="min-h-screen bg-white">
        {renderHeader(false)}
        <TableSessionLock tableNumber={tableNumber} />
      </div>
    )
  }

  // ─── STATE 2: ACTIVE ORDER TRACKER — SESSION OWNER ───────────────────────────
  if (dbLocked && ownsActiveSession && !showMenu && currentSession) {
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

  // ─── STATE 1: TABLE FREE → BROWSE MENU ───────────────────────────────────────
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
            View Placed Order (₹{Number(dbSession?.totalAmount || 0).toFixed(0)}) ➜
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
          <div className="flex items-center gap-2">
            <Image src="/logo.jpeg" width={32} height={32} className="rounded-full border border-brand-border" alt="HFC Logo" />
            <span className="font-brand font-black text-[15px] text-brand-red tracking-tight">HFC</span>
          </div>
          <div className="flex items-center gap-1.5 bg-brand-red text-white rounded-full px-3.5 py-1">
            <UtensilsCrossed size={12} />
            <span className="font-brand font-bold text-[12.5px]">Table {tableNumber}</span>
          </div>
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
