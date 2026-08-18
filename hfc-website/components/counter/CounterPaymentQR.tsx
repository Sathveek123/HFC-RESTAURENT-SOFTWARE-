'use client'

import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, ChevronLeft, AlertCircle, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface CounterPaymentQRProps {
  total: number
  upiId: string
  siteName: string
  items: { name: string; quantity: number; price: number }[]
  notes: string
  packagingCharge: number
  gst: number
  subtotal: number
  onBack: () => void
  onPaid: (orderId: string, tokenNumber: string) => void
}

export default function CounterPaymentQR({
  total,
  upiId,
  siteName,
  items,
  notes,
  packagingCharge,
  gst,
  subtotal,
  onBack,
  onPaid,
}: CounterPaymentQRProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(siteName)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Counter Order')}`

  const handlePaid = async () => {
    setShowConfirmModal(false)
    setLoading(true)
    try {
      const res = await fetch('/api/counter/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, subtotal, packagingCharge, gst, total, notes: notes || null }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to place order. Please try again.')
        setLoading(false)
        return
      }

      onPaid(data.orderId, data.tokenNumber)
    } catch (err) {
      toast.error('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-start pt-8 pb-24 px-4 relative">
      {/* Back */}
      <div className="w-full max-w-sm mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] font-brand font-bold text-brand-muted hover:text-brand-black cursor-pointer"
        >
          <ChevronLeft size={16} /> Back to Bill
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-sm text-center mb-6">
        <h2 className="font-display font-bold text-[26px] text-brand-black">Scan to Pay</h2>
        <p className="font-body text-[13px] text-brand-muted mt-1">
          Use PhonePe, GPay, Paytm, or any UPI app
        </p>
      </div>

      {/* Amount */}
      <div className="w-full max-w-sm bg-brand-red rounded-[16px] px-6 py-5 text-center mb-6 shadow-md shadow-brand-redLight/30">
        <p className="font-brand font-semibold text-[11px] text-red-100 uppercase tracking-[2px]">Total Payable</p>
        <p className="font-brand font-black text-[44px] text-white leading-tight mt-1">
          ₹{total.toFixed(2)}
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white border-2 border-brand-border rounded-[20px] p-6 flex flex-col items-center shadow-sm mb-5">
        <QRCodeSVG value={upiUrl} size={200} level="M" />
        <span className="font-mono text-[10px] text-brand-muted mt-3 select-all">{upiId}</span>
      </div>

      {/* Tap to Pay link (mobile UPI deep-link) */}
      <a
        href={upiUrl}
        className="inline-flex items-center gap-2 font-brand font-bold text-[12px] text-brand-red bg-brand-redLight px-5 py-2.5 rounded-full hover:bg-brand-red hover:text-white transition-colors uppercase tracking-[0.5px] mb-6"
      >
        📱 Tap to Open UPI App
      </a>

      {/* Paid button */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={loading}
          className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-brand font-bold text-[14px] uppercase tracking-[1px] py-4 rounded-btn flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Check size={18} /> I Have Paid — Get My Token
            </>
          )}
        </button>

        {/* Cash disclaimer */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-2.5">
          <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
          <p className="font-body text-[11.5px] text-amber-800">
            Paying cash? Inform the staff at the counter and they'll process your order.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] p-6 max-w-sm w-full shadow-2xl border border-brand-border animate-in fade-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-100">
                <HelpCircle className="text-amber-600" size={24} />
              </div>
              <h3 className="font-brand font-bold text-[18px] text-brand-black mb-2">Confirm Payment</h3>
              <p className="font-body text-[13px] text-brand-muted mb-6 leading-relaxed">
                Have you completed the UPI payment of <span className="font-brand font-bold text-brand-black text-[14px]">₹{total.toFixed(2)}</span>?
              </p>
              <div className="flex flex-col w-full gap-2">
                <button
                  onClick={handlePaid}
                  className="w-full py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-brand font-bold text-[13px] rounded-btn shadow-md uppercase tracking-[0.5px]"
                >
                  Yes, Show My Token
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-brand-black font-brand font-bold text-[13px] rounded-btn uppercase tracking-[0.5px]"
                >
                  No, Go Back to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
