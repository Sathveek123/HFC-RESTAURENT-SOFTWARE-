'use client'

import React from 'react'
import { CheckCircle2, Printer, X } from 'lucide-react'

interface KOTPreviewProps {
  kotNumber: string
  tableNumber: string
  items: { name: string; quantity: number }[]
  onClose: () => void
}

export default function KOTPreview({
  kotNumber,
  tableNumber,
  items,
  onClose
}: KOTPreviewProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[20px] p-5 max-w-sm w-full shadow-2xl border border-brand-border animate-in fade-in duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-muted hover:text-brand-black transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3 border border-green-100">
            <CheckCircle2 className="text-green-600" size={24} />
          </div>
          <h3 className="font-brand font-bold text-[18px] text-brand-black mb-1">KOT Generated</h3>
          <p className="font-body text-[12px] text-brand-muted mb-4">
            Order successfully accepted and sent to kitchen.
          </p>

          {/* Paper Ticket Mockup */}
          <div className="w-full bg-[#FAF9F6] border-2 border-dashed border-brand-border rounded-[8px] p-4 font-mono text-[12px] text-brand-black space-y-3 mb-5 shadow-xs">
            <div className="text-center font-bold pb-2 border-b border-dashed border-brand-border">
              <p className="text-[14px]">HFC KITCHEN TICKET</p>
              <p className="text-[10px] text-brand-muted mt-0.5">{new Date().toLocaleString()}</p>
            </div>
            
            <div className="flex justify-between font-bold">
              <span>TABLE: {tableNumber}</span>
              <span>{kotNumber}</span>
            </div>

            <div className="w-full h-[1px] bg-brand-border border-b border-dashed border-brand-border my-2" />

            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.name}</span>
                  <span>×{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="w-full h-[1px] bg-brand-border border-b border-dashed border-brand-border my-2" />
            
            <p className="text-center text-[10px] text-brand-muted italic">
              Digital KOT dispatched to KDS screen.
            </p>
          </div>

          <div className="flex w-full gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-brand-black hover:bg-brand-red text-white font-brand font-bold text-[12px] rounded-btn uppercase tracking-[0.5px] cursor-pointer text-center"
            >
              Done
            </button>
            <button
              onClick={() => {
                toast.success('KOT print request queued (Hardware bridge out-of-scope).')
              }}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-brand-black font-brand font-bold text-[12px] rounded-btn cursor-pointer flex items-center justify-center gap-1.5"
              title="Print Physical Receipt"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
import toast from 'react-hot-toast'
