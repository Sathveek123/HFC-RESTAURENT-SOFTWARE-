'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Bell, Check, Clock, XCircle } from 'lucide-react'

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
}

interface Order {
  id: string
  table_number: string
  items: OrderItem[]
  subtotal: number
  gst: number
  total: number
  status: 'placed' | 'accepted' | 'ready' | 'served' | 'rejected'
  placed_at: string
  accepted_at?: string
  notes?: string
}

interface WaiterOrderCardProps {
  order: Order
  activeTab: 'new' | 'accepted'
  onAccept: (orderId: string) => void
  onRejectClick: (orderId: string) => void
  onMarkServed: (orderId: string) => void
  submittingAction: string | null
}

export default function WaiterOrderCard({
  order,
  activeTab,
  onAccept,
  onRejectClick,
  onMarkServed,
  submittingAction
}: WaiterOrderCardProps) {
  const isNew = order.status === 'placed'
  const isReady = order.status === 'ready'
  const isAccepted = order.status === 'accepted'

  const formattedTime = order.placed_at
    ? formatDistanceToNow(new Date(order.placed_at), { addSuffix: true })
    : ''

  const loadingAccept = submittingAction === `accept-${order.id}`
  const loadingServe = submittingAction === `serve-${order.id}`

  return (
    <div
      className={`bg-white border rounded-[12px] p-4 shadow-xs transition-all ${
        isReady ? 'border-green-300 ring-2 ring-green-500/10' : 'border-brand-border'
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-brand font-black text-[15px] text-brand-black">
            Table No.: {order.table_number}
          </span>
          <p className="font-body text-[11px] text-brand-muted mt-0.5">
            ID: #{order.id.slice(-8)} · {formattedTime}
          </p>
        </div>
        <div className="text-right">
          <span className="font-brand font-black text-[15px] text-brand-red">
            ₹{Number(order.total).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Special Instructions Notes */}
      {order.notes && (
        <div className="bg-amber-50/70 border border-amber-100 rounded-[6px] px-2.5 py-1.5 mb-3">
          <p className="font-body text-[11px] text-amber-800">
            ✍️ <strong>Instructions:</strong> {order.notes}
          </p>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1.5 mb-4 pb-3 border-b border-brand-border font-body text-[12.5px]">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between">
            <span className="text-brand-black">{item.name}</span>
            <span className="text-brand-muted">×{item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Accept / Reject Buttons for New Tab */}
      {isNew && (
        <div className="flex gap-2">
          <button
            onClick={() => onRejectClick(order.id)}
            disabled={!!submittingAction}
            className="flex-1 bg-white border border-red-500 text-red-500 font-brand font-bold text-[12px] uppercase py-2.5 rounded-btn hover:bg-red-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reject
          </button>
          <button
            onClick={() => onAccept(order.id)}
            disabled={!!submittingAction}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-brand font-bold text-[12px] uppercase py-2.5 rounded-btn active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            {loadingAccept ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Accept'
            )}
          </button>
        </div>
      )}

      {/* Accepted Tab status displays */}
      {!isNew && (
        <div className="space-y-3">
          {/* Status Pill */}
          <div className="flex items-center">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-brand font-bold text-[9.5px] uppercase border ${
                isReady
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-amber-500'}`} />
              {isReady ? '✓ Food Prepared' : 'Preparing in Kitchen'}
            </span>
          </div>

          {/* Order Ready Alert banner */}
          {isReady && (
            <div className="bg-green-50 border border-green-200 rounded-[8px] p-2.5 flex items-center gap-2 animate-bounce">
              <Bell size={14} className="text-green-600 flex-shrink-0 animate-swing" />
              <span className="font-body text-[11px] text-green-800">
                Ready for pick up — serve table {order.table_number}!
              </span>
            </div>
          )}

          {/* Mark Served CTA */}
          <button
            onClick={() => onMarkServed(order.id)}
            disabled={!isReady || !!submittingAction}
            className={`w-full font-brand font-bold text-[12px] uppercase py-2.5 rounded-btn transition-all flex items-center justify-center gap-1.5 ${
              isReady
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-[0.98]'
                : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loadingServe ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check size={14} /> Mark Served to Customer
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
