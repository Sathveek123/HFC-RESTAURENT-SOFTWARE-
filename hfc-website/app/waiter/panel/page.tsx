'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useWaiterStore } from '@/store/waiterStore'
import { supabase } from '@/lib/supabase'
import WaiterOrderCard from '@/components/waiter/WaiterOrderCard'
import RejectOrderModal from '@/components/waiter/RejectOrderModal'
import KOTPreview from '@/components/waiter/KOTPreview'
import { Bell, AlertCircle, RefreshCw, Loader2, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Web Audio Bell Chime Pattern ───────────────────────────────────────────
function playBell(ctx: AudioContext, freq: number, vol: number, delay: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.8)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + 0.8)
}

function playWaiterChime(type: 'new-order' | 'ready-order') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    if (type === 'new-order') {
      playBell(ctx, 880, 0.25, 0)
      playBell(ctx, 1100, 0.25, 0.15)
    } else {
      playBell(ctx, 587, 0.3, 0)
      playBell(ctx, 587, 0.3, 0.1)
      playBell(ctx, 880, 0.35, 0.2)
    }
  } catch (e) {
    console.warn('Audio blocked:', e)
  }
}

export default function WaiterPanelPage() {
  const activeOrders = useWaiterStore(state => state.activeOrders)
  const fetchActiveOrders = useWaiterStore(state => state.fetchActiveOrders)
  const acceptOrder = useWaiterStore(state => state.acceptOrder)
  const rejectOrder = useWaiterStore(state => state.rejectOrder)
  const markServed = useWaiterStore(state => state.markServed)
  const waiter = useWaiterStore(state => state.waiter)
  const isLoading = useWaiterStore(state => state.isLoading)

  const [activeTab, setActiveTab] = useState<'new' | 'accepted'>('new')
  const [submittingAction, setSubmittingAction] = useState<string | null>(null)
  
  // Modal states
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null)
  const [previewKotOrder, setPreviewKotOrder] = useState<{ kotNumber: string; tableNumber: string; items: any[] } | null>(null)

  // Realtime subscription setup
  useEffect(() => {
    fetchActiveOrders()

    const channel = supabase
      .channel(`waiter-panel-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_orders' },
        (payload) => {
          fetchActiveOrders()

          // Trigger audio chimes
          if (payload.eventType === 'INSERT' && payload.new.status === 'placed') {
            playWaiterChime('new-order')
            toast('🔔 New Table Order Received!', {
              style: { background: '#FFFBEB', color: '#b45309', fontWeight: 'bold' }
            })
          } else if (
            payload.eventType === 'UPDATE' &&
            payload.new.status === 'ready' &&
            payload.old.status !== 'ready'
          ) {
            playWaiterChime('ready-order')
            toast.success(`🍳 Order for Table ${payload.new.table_number} is ready!`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchActiveOrders])

  // Filter lists based on tab
  const newOrders = useMemo(() => {
    return activeOrders.filter(o => o.status === 'placed')
  }, [activeOrders])

  const acceptedOrders = useMemo(() => {
    return activeOrders.filter(o => ['accepted', 'ready'].includes(o.status))
  }, [activeOrders])

  // Handlers
  const handleAccept = async (orderId: string) => {
    setSubmittingAction(`accept-${orderId}`)
    const order = activeOrders.find(o => o.id === orderId)
    const res = await acceptOrder(orderId)
    setSubmittingAction(null)

    if (res.success && res.kotNumber && order) {
      setPreviewKotOrder({
        kotNumber: res.kotNumber,
        tableNumber: order.table_number,
        items: order.items
      })
    } else if (res.error) {
      toast.error(res.error)
    }
  }

  const handleConfirmReject = async (reason: string) => {
    if (!rejectingOrderId) return
    setSubmittingAction(`reject-${rejectingOrderId}`)
    const res = await rejectOrder(rejectingOrderId, reason)
    setSubmittingAction(null)
    setRejectingOrderId(null)

    if (res.error) {
      toast.error(res.error)
    }
  }

  const handleMarkServed = async (orderId: string) => {
    setSubmittingAction(`serve-${orderId}`)
    const res = await markServed(orderId)
    setSubmittingAction(null)

    if (res.error) {
      toast.error(res.error)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] pb-24 relative">
      
      {/* Scope Alert Banner */}
      {waiter?.assignedTables && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-center text-blue-800 text-[11px] font-body">
          🎯 Monitoring Table Assignment: <strong>{waiter.assignedTables.join(', ')}</strong>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-brand-border sticky top-12 z-20 bg-white">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-3 font-brand font-bold text-[13px] uppercase tracking-[0.5px] border-b-2 transition-all ${
            activeTab === 'new'
              ? 'border-brand-red text-brand-red bg-red-50/10'
              : 'border-transparent text-brand-muted hover:text-brand-black'
          }`}
        >
          New Orders ({newOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('accepted')}
          className={`flex-1 py-3 font-brand font-bold text-[13px] uppercase tracking-[0.5px] border-b-2 transition-all ${
            activeTab === 'accepted'
              ? 'border-green-600 text-green-600 bg-green-50/10'
              : 'border-transparent text-brand-muted hover:text-brand-black'
          }`}
        >
          Accepted ({acceptedOrders.length})
        </button>
      </div>

      {/* Main List */}
      <div className="flex-1 p-4 space-y-4">
        {isLoading && activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-brand-muted space-y-2">
            <Loader2 className="animate-spin text-brand-red" size={32} />
            <p className="font-body text-[13px]">Refreshing active logs...</p>
          </div>
        ) : activeTab === 'new' ? (
          newOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
              <ClipboardList size={48} className="text-brand-muted mb-3" />
              <span className="font-body text-[13px] text-brand-muted">No pending table orders</span>
            </div>
          ) : (
            newOrders.map(order => (
              <WaiterOrderCard
                key={order.id}
                order={order}
                activeTab="new"
                onAccept={handleAccept}
                onRejectClick={setRejectingOrderId}
                onMarkServed={handleMarkServed}
                submittingAction={submittingAction}
              />
            ))
          )
        ) : acceptedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
            <RefreshCw size={48} className="text-brand-muted mb-3" />
            <span className="font-body text-[13px] text-brand-muted">No accepted orders in preparation</span>
          </div>
        ) : (
          acceptedOrders.map(order => (
            <WaiterOrderCard
              key={order.id}
              order={order}
              activeTab="accepted"
              onAccept={handleAccept}
              onRejectClick={setRejectingOrderId}
              onMarkServed={handleMarkServed}
              submittingAction={submittingAction}
            />
          ))
        )}
      </div>

      {/* Manual Refresh Trigger */}
      <button
        onClick={fetchActiveOrders}
        className="fixed bottom-4 right-4 p-3 bg-brand-black text-white rounded-full shadow-lg hover:bg-brand-red transition-all active:scale-95 cursor-pointer z-30"
        title="Sync Database Manual"
      >
        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
      </button>

      {/* Modals overlay rendering */}
      {rejectingOrderId && (
        <RejectOrderModal
          orderId={rejectingOrderId}
          onClose={() => setRejectingOrderId(null)}
          onConfirm={handleConfirmReject}
          submitting={submittingAction === `reject-${rejectingOrderId}`}
        />
      )}

      {previewKotOrder && (
        <KOTPreview
          kotNumber={previewKotOrder.kotNumber}
          tableNumber={previewKotOrder.tableNumber}
          items={previewKotOrder.items}
          onClose={() => setPreviewKotOrder(null)}
        />
      )}
    </div>
  )
}
