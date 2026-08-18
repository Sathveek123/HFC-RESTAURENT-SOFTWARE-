'use client'

import React from 'react'
import { ChevronLeft, ShoppingBag } from 'lucide-react'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface CounterCheckoutProps {
  items: CartItem[]
  packagingCharge: number
  gstPercent: number
  onBack: () => void
  onProceedToPay: () => void
}

export default function CounterCheckout({
  items,
  packagingCharge,
  gstPercent,
  onBack,
  onProceedToPay,
}: CounterCheckoutProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const gst = Math.round(subtotal * (gstPercent / 100) * 100) / 100
  const total = subtotal + packagingCharge + gst

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-start pt-8 pb-32 px-4">
      {/* Back */}
      <div className="w-full max-w-sm mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-brand font-bold text-brand-muted hover:text-brand-black cursor-pointer"
        >
          <ChevronLeft size={16} /> Back to Menu
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-sm mb-5">
        <h2 className="font-display font-bold text-[24px] text-brand-black flex items-center gap-2">
          <ShoppingBag size={22} className="text-brand-red" />
          Order Summary
        </h2>
        <p className="font-body text-[13px] text-brand-muted mt-0.5">Counter self-service takeaway</p>
      </div>

      {/* Items */}
      <div className="w-full max-w-sm bg-white border border-brand-border rounded-[16px] p-5 shadow-xs mb-4">
        <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-[1.5px] mb-3">
          Items
        </p>
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-[13.5px]">
              <div>
                <span className="font-body font-semibold text-brand-black">{item.name}</span>
                <span className="font-brand font-bold text-brand-muted ml-1.5">×{item.quantity}</span>
              </div>
              <span className="font-brand font-bold text-brand-black">
                ₹{(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bill Breakdown */}
      <div className="w-full max-w-sm bg-white border border-brand-border rounded-[16px] p-5 shadow-xs mb-6">
        <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-[1.5px] mb-3">
          Bill Breakdown
        </p>
        <div className="space-y-2.5">
          <div className="flex justify-between text-[13px]">
            <span className="font-body text-brand-muted">Items Total</span>
            <span className="font-brand font-semibold text-brand-black">₹{subtotal.toFixed(2)}</span>
          </div>
          {packagingCharge > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="font-body text-brand-muted">Packaging</span>
              <span className="font-brand font-semibold text-brand-black">₹{packagingCharge.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px]">
            <span className="font-body text-brand-muted">GST ({gstPercent}%)</span>
            <span className="font-brand font-semibold text-brand-black">₹{gst.toFixed(2)}</span>
          </div>
          <div className="border-t border-brand-border pt-3 flex justify-between">
            <span className="font-brand font-bold text-[16px] text-brand-black">TOTAL</span>
            <span className="font-brand font-black text-[20px] text-brand-red">₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-brand-border max-w-sm mx-auto z-50">
        <button
          onClick={onProceedToPay}
          className="w-full bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[14px] uppercase tracking-[1px] py-4 rounded-btn flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
        >
          Proceed to Pay — ₹{total.toFixed(2)}
        </button>
      </div>
    </div>
  )
}
