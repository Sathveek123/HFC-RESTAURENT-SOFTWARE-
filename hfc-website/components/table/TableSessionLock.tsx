'use client'

import React from 'react'
import { Lock } from 'lucide-react'

interface TableSessionLockProps {
  tableNumber: string
}

export default function TableSessionLock({ tableNumber }: TableSessionLockProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white px-6 text-center animate-fade-in">
      {/* Lock Icon */}
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100 shadow-sm">
        <Lock size={36} className="text-brand-red" />
      </div>

      {/* Message */}
      <h2 className="font-display font-bold text-[24px] text-brand-black mb-2">
        Table {tableNumber} is Occupied
      </h2>
      <p className="font-body text-[14px] text-brand-muted mb-8 max-w-[280px] leading-relaxed">
        This table currently has guests seated. Please scan the QR code at your own table, or ask a staff member for assistance.
      </p>

      {/* Staff Help */}
      <div className="w-full max-w-[320px] bg-brand-surface border border-brand-border rounded-[12px] p-4">
        <p className="font-brand font-semibold text-[12px] text-brand-muted uppercase tracking-wider mb-1">Need help?</p>
        <p className="font-body text-[13px] text-brand-black leading-relaxed">
          Ask a staff member or go to the counter — they'll direct you to your table's QR code.
        </p>
      </div>
    </div>
  )
}
