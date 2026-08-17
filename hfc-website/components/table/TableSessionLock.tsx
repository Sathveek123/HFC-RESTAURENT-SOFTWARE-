'use client'

import React from 'react'
import { Lock } from 'lucide-react'

interface TableSessionLockProps {
  tableNumber: string
  currentSessionTotal: number
  roundCount: number
  onViewOrder: () => void
}

export default function TableSessionLock({
  tableNumber,
  currentSessionTotal,
  roundCount,
  onViewOrder
}: TableSessionLockProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white px-6 text-center animate-fade-in">
      {/* Lock Icon */}
      <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-sm">
        <Lock size={36} className="text-amber-500" />
      </div>

      {/* Message */}
      <h2 className="font-display font-bold text-[24px] text-brand-black mb-2">
        Table {tableNumber} is Active
      </h2>
      <p className="font-body text-[14px] text-brand-muted mb-6 max-w-[280px] leading-relaxed">
        Someone at your table has already placed an order. Only they can add more items until payment is done.
      </p>

      {/* Current Session Summary */}
      <div className="w-full max-w-[320px] bg-brand-surface border border-brand-border rounded-[12px] p-4 mb-6">
        <div className="flex justify-between mb-2">
          <span className="font-body text-[13px] text-brand-muted">Session Total</span>
          <span className="font-brand font-bold text-[15px] text-brand-red">
            ₹{currentSessionTotal.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-body text-[13px] text-brand-muted">Orders Placed</span>
          <span className="font-brand font-semibold text-[13px] text-brand-black">
            {roundCount} round{roundCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* View Current Order Button */}
      <button
        onClick={onViewOrder}
        className="w-full max-w-[320px] border-2 border-brand-red text-brand-red font-brand font-bold text-[13px] uppercase tracking-[1px] py-3.5 rounded-btn hover:bg-brand-redLight transition-all duration-150 mb-4 cursor-pointer"
      >
        View Current Order
      </button>

      {/* Staff Help */}
      <p className="font-body text-[11px] text-brand-muted">
        Need help? Please call staff or ask at the counter.
      </p>
    </div>
  )
}
