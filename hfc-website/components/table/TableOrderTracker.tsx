'use client'

import React, { useState, useEffect } from 'react'
import { Clock, ChefHat, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTableStore } from '@/store/tableStore'

interface OrderRound {
  id: string
  round_number: number
  items: { id: string; name: string; price: number; quantity: number }[]
  status: 'placed' | 'accepted' | 'ready' | 'served' | 'rejected'
  kot_number: string
  placed_at: string
  special_instructions?: string
}

interface TableOrderTrackerProps {
  sessionId: string
  tableNumber: string
  onAddMore: () => void
  onCheckout: () => void
}

export default function TableOrderTracker({
  sessionId,
  tableNumber,
  onAddMore,
  onCheckout
}: TableOrderTrackerProps) {
  const [rounds, setRounds] = useState<OrderRound[]>([])
  const [loading, setLoading] = useState(true)
  const isSessionLoading = useTableStore(state => state.isSessionLoading)

  useEffect(() => {
    const fetchRounds = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('table_orders')
        .select('*')
        .eq('session_id', sessionId)
        .order('round_number', { ascending: false })

      if (!error && data) {
        setRounds(data as OrderRound[])
      }
      setLoading(false)
    }

    fetchRounds()

    // Subscribe to realtime changes on table_orders for this session
    const channel = supabase
      .channel(`table-orders-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_orders',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRounds(prev => [payload.new as OrderRound, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setRounds(prev => prev.map(r => r.id === payload.new.id ? (payload.new as OrderRound) : r))
          } else if (payload.eventType === 'DELETE') {
            setRounds(prev => prev.filter(r => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const getStatusBadge = (status: OrderRound['status']) => {
    switch (status) {
      case 'placed':
        return (
          <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full text-[11px] font-brand font-bold uppercase tracking-wider">
            <Clock size={11} /> Sent to Kitchen
          </span>
        )
      case 'accepted':
        return (
          <span className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 px-2.5 py-1 rounded-full text-[11px] font-brand font-bold uppercase tracking-wider animate-pulse">
            <ChefHat size={11} /> Cooking
          </span>
        )
      case 'ready':
        return (
          <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 px-2.5 py-1 rounded-full text-[11px] font-brand font-bold uppercase tracking-wider">
            <AlertCircle size={11} /> Ready to Serve
          </span>
        )
      case 'served':
        return (
          <span className="flex items-center gap-1 bg-green-50 border border-green-200 text-green-600 px-2.5 py-1 rounded-full text-[11px] font-brand font-bold uppercase tracking-wider">
            <CheckCircle2 size={11} /> Served
          </span>
        )
      case 'rejected':
        return (
          <span className="flex items-center gap-1 bg-red-50 border border-red-200 text-brand-red px-2.5 py-1 rounded-full text-[11px] font-brand font-bold uppercase tracking-wider">
            ✕ Cancelled
          </span>
        )
    }
  }

  // Calculate bill totals
  const totals = rounds.reduce(
    (acc, curr) => {
      if (curr.status !== 'rejected') {
        const roundItemsPrice = curr.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        acc.subtotal += roundItemsPrice
      }
      return acc
    },
    { subtotal: 0 }
  )

  const gst = Math.round(totals.subtotal * 0.05 * 100) / 100
  const finalTotal = totals.subtotal + gst

  return (
    <div className="space-y-6 px-4 pt-4 pb-32 max-w-md mx-auto animate-fade-in">
      {/* Header Info */}
      <div className="bg-brand-surface border border-brand-border rounded-[16px] p-5 text-center shadow-xs">
        <h2 className="font-display font-extrabold text-[22px] text-brand-black">Your Order Status</h2>
        <p className="font-body text-[13px] text-brand-muted mt-1">Dine-in at Table {tableNumber}</p>
      </div>

      {/* Rounds List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
          <p className="font-brand font-semibold text-[13px] text-brand-muted mt-3">Loading rounds...</p>
        </div>
      ) : rounds.length === 0 ? (
        <div className="text-center py-12 bg-brand-surface rounded-[16px] border border-brand-border">
          <p className="font-body text-[13.5px] text-brand-muted">No rounds placed yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map(round => (
            <div
              key={round.id}
              className={`bg-white border rounded-[16px] shadow-xs overflow-hidden ${
                round.status === 'rejected' ? 'border-gray-200 opacity-60' : 'border-brand-border'
              }`}
            >
              {/* Round Header */}
              <div className="p-4 border-b border-brand-border bg-[#FAFAFA] flex items-center justify-between">
                <div>
                  <span className="font-brand font-bold text-[14px] text-brand-black block">
                    Round {round.round_number}
                  </span>
                  <span className="font-mono text-[10px] text-brand-muted mt-0.5 block">
                    KOT: {round.kot_number}
                  </span>
                </div>
                {getStatusBadge(round.status)}
              </div>

              {/* Round Items */}
              <div className="p-4 space-y-2.5">
                {round.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[13.5px]">
                    <div className="flex items-start gap-2">
                      <span className="font-brand font-extrabold text-brand-black">{item.quantity}x</span>
                      <span className="font-body font-semibold text-brand-black">{item.name}</span>
                    </div>
                    <span className="font-brand font-bold text-brand-muted">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}

                {round.special_instructions && (
                  <div className="mt-3 p-2 bg-amber-50/50 border border-amber-100 rounded-[8px] text-[11.5px] font-body text-amber-800">
                    <span className="font-semibold">Note:</span> {round.special_instructions}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bill Preview Card */}
      {rounds.length > 0 && (
        <div className="bg-white border border-brand-border rounded-[16px] p-5 shadow-xs space-y-3">
          <div className="flex justify-between text-[13px] text-brand-muted">
            <span>Running Subtotal</span>
            <span>₹{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-brand-muted">
            <span>GST (5%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className="border-t border-brand-border pt-3 flex justify-between font-brand font-extrabold text-[17px] text-brand-black">
            <span>Current Total</span>
            <span className="text-brand-red">₹{finalTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-brand-border flex gap-3 max-w-md mx-auto">
        <button
          onClick={onAddMore}
          className="flex-1 border-2 border-brand-red text-brand-red hover:bg-brand-redLight font-brand font-bold text-[13px] uppercase tracking-wider py-3.5 rounded-btn transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ShoppingCart size={15} /> Add More
        </button>

        <button
          onClick={onCheckout}
          disabled={isSessionLoading || rounds.length === 0}
          className="flex-1 bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[13px] uppercase tracking-wider py-3.5 rounded-btn transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-brand-redLight/20 disabled:opacity-50"
        >
          Complete & Pay
        </button>
      </div>
    </div>
  )
}
