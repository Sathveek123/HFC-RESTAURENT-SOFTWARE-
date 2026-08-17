'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface OrderRound {
  id: string
  round_number: number
  items: OrderItem[]
  status: string
  kot_number: string
}

interface TableOrderSummaryProps {
  sessionId: string
  tableNumber: string
}

export default function TableOrderSummary({ sessionId, tableNumber }: TableOrderSummaryProps) {
  const [rounds, setRounds] = useState<OrderRound[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRounds = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('table_orders')
        .select('*')
        .eq('session_id', sessionId)
        .order('round_number', { ascending: true })

      if (!error && data) {
        setRounds(data as OrderRound[])
      }
      setLoading(false)
    }
    fetchRounds()
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Calculate totals
  const activeRounds = rounds.filter(r => r.status !== 'rejected')
  const subtotal = activeRounds.reduce((sum, round) => {
    return sum + round.items.reduce((rSum, item) => rSum + item.price * item.quantity, 0)
  }, 0)

  const gst = Math.round(subtotal * 0.05 * 100) / 100
  const total = subtotal + gst

  return (
    <div className="bg-white border border-brand-border rounded-[20px] p-6 shadow-sm max-w-md mx-auto animate-fade-in font-body text-[13.5px]">
      <div className="text-center pb-4 border-b border-dashed border-brand-border space-y-1">
        <h3 className="font-brand font-black text-[16px] text-brand-black uppercase">Final Bill Summary</h3>
        <p className="text-[12px] text-brand-muted">Table {tableNumber} | Session: {sessionId.slice(-8)}</p>
      </div>

      {/* Bill Items list */}
      <div className="py-4 space-y-4 max-h-[240px] overflow-y-auto pr-1">
        {activeRounds.map(round => (
          <div key={round.id} className="space-y-2">
            <span className="font-brand font-bold text-[11px] text-brand-red uppercase tracking-wider">
              Round {round.round_number} (KOT: {round.kot_number})
            </span>
            <div className="space-y-2 pl-2">
              {round.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-brand-black">
                  <div className="flex gap-2">
                    <span className="font-semibold text-brand-muted">{item.quantity}x</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold text-brand-muted">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bill Totals Breakout */}
      <div className="border-t border-brand-border pt-4 space-y-2.5">
        <div className="flex justify-between text-brand-muted">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-brand-muted">
          <span>GST (5%)</span>
          <span>₹{gst.toFixed(2)}</span>
        </div>
        <div className="border-t border-brand-border pt-3.5 flex justify-between font-brand font-black text-[17.5px] text-brand-black">
          <span>Total Amount</span>
          <span className="text-brand-red">₹{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
