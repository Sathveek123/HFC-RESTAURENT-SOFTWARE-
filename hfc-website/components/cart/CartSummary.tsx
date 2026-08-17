'use client'

import { MessageCircle, Download } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { generateWhatsAppMessage, downloadOrderSummary } from '@/lib/utils'

export default function CartSummary() {
  const items = useCartStore(state => state.items)
  const getSubtotal = useCartStore(state => state.getSubtotal)
  const settings = useSettingsStore(state => state.settings)

  const subtotal = getSubtotal()

  const gstMode: 'none' | 'inclusive' | 'exclusive' = settings?.gstMode ?? 'exclusive'
  const gstPercent = settings?.gstPercent ?? 5
  let gst = 0
  if (gstMode === 'exclusive') {
    gst = Math.round(subtotal * (gstPercent / 100))
  }
  const total = subtotal + gst

  const handleWhatsAppOrder = () => {
    if (items.length === 0) return
    const encodedMsg = generateWhatsAppMessage(items, total)
    const whatsappUrl = `https://wa.me/${settings?.whatsappNumber || '919876543210'}?text=${encodedMsg}`
    window.open(whatsappUrl, '_blank')
  }

  const handleDownload = () => {
    if (items.length === 0) return
    downloadOrderSummary(items, subtotal, gst, total)
  }

  return (
    <div className="px-6 pb-6 pt-4 border-t border-brand-border bg-brand-surface space-y-3">
      {/* Subtotal */}
      <div className="flex justify-between font-body text-[14px] text-brand-body">
        <span>Subtotal</span>
        <span className="text-brand-black font-semibold">₹ {subtotal.toLocaleString('en-IN')}</span>
      </div>

      {/* GST — respects gstMode */}
      {gstMode === 'exclusive' && gst > 0 && (
        <div className="flex justify-between font-body text-[14px] text-brand-body">
          <span>GST ({gstPercent}%)</span>
          <span className="text-brand-black font-semibold">₹ {gst.toLocaleString('en-IN')}</span>
        </div>
      )}
      {gstMode === 'inclusive' && (
        <div className="flex justify-between font-body text-[12px] text-brand-muted italic">
          <span>GST ({gstPercent}%)</span>
          <span>Already in menu prices</span>
        </div>
      )}

      {/* Grand Total */}
      <div className="flex justify-between pt-3 border-t border-brand-border">
        <span className="font-brand font-bold text-[18px] text-brand-black">Total</span>
        <span className="font-brand font-bold text-[20px] text-brand-red">
          ₹ {total.toLocaleString('en-IN')}
        </span>
      </div>

      {/* WhatsApp Button */}
      <button
        onClick={handleWhatsAppOrder}
        className="w-full h-[52px] bg-brand-whatsapp hover:bg-[#1da851] text-white font-brand font-semibold text-[13px] uppercase tracking-[1.5px] rounded-btn transition-colors duration-200 flex items-center justify-center gap-2 mt-2 shadow-sm"
      >
        <MessageCircle size={18} /> Place Order via WhatsApp
      </button>

      {/* Download Summary */}
      <button
        onClick={handleDownload}
        className="w-full h-[48px] border-2 border-brand-black text-brand-black hover:bg-brand-black hover:text-white font-brand font-semibold text-[12px] uppercase tracking-[1.5px] rounded-btn transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Download size={16} /> Download Order Summary
      </button>
    </div>
  )
}
