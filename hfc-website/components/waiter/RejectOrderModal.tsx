'use client'

import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface RejectOrderModalProps {
  orderId: string
  onClose: () => void
  onConfirm: (reason: string) => void
  submitting: boolean
}

export default function RejectOrderModal({
  orderId,
  onClose,
  onConfirm,
  submitting
}: RejectOrderModalProps) {
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    onConfirm(reason.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[20px] p-5 max-w-sm w-full shadow-2xl border border-brand-border animate-in fade-in duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-muted hover:text-brand-black transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3 border border-red-100">
            <AlertTriangle className="text-brand-red" size={22} />
          </div>
          <h3 className="font-brand font-bold text-[18px] text-brand-black mb-1">Reject Table Order</h3>
          <p className="font-body text-[12px] text-brand-muted mb-4 leading-relaxed">
            Please enter a reason for declining Order #{orderId.slice(-8)}. The customer will see this message in real-time.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <textarea
              required
              placeholder="e.g. Dish unavailable, kitchen closing soon"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-brand-border rounded-[8px] p-3 font-body text-[13px] text-brand-black focus:border-brand-red focus:outline-none transition-all bg-white"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-brand-black font-brand font-bold text-[12px] rounded-btn uppercase tracking-[0.5px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="flex-1 py-3 bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[12px] rounded-btn uppercase tracking-[0.5px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Confirm Reject'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
