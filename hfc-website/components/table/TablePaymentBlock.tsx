'use client'

import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface TablePaymentBlockProps {
  sessionId: string
  totalAmount: number
  tableNumber: string
  onPaymentNotified: () => void
}

export default function TablePaymentBlock({
  sessionId,
  totalAmount,
  tableNumber,
  onPaymentNotified
}: TablePaymentBlockProps) {
  const settings = useSettingsStore(state => state.settings)
  const [notified, setNotified] = useState(false)
  const [loading, setLoading] = useState(false)

  const upiId = settings.upiId || '9912799855@okbizaxis'
  const siteName = settings.siteName || 'HFC Restaurant'

  // Generate standard UPI payload URL
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(siteName)}&am=${totalAmount.toFixed(2)}&cu=INR`

  const handleNotifyPayment = async () => {
    setLoading(true)
    try {
      // Update session notes in Supabase to trigger real-time admin alert
      const { error } = await supabase
        .from('table_sessions')
        .update({ notes: 'PAID_NOTIFIED' })
        .eq('id', sessionId)

      if (error) {
        toast.error('Failed to notify staff: ' + error.message)
      } else {
        setNotified(true)
        toast.success('Staff notified! They will verify and release the table shortly.')
        onPaymentNotified()
      }
    } catch (e) {
      toast.error('Connection error')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white border border-brand-border rounded-[20px] p-6 shadow-sm text-center max-w-md mx-auto animate-fade-in space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-display font-extrabold text-[20px] text-brand-black">Complete & Pay</h2>
        <p className="font-body text-[12px] text-brand-muted mt-1">Please pay using any UPI app or cash at the counter</p>
      </div>

      {/* Amount Display */}
      <div className="bg-brand-surface rounded-[12px] p-4 border border-brand-border">
        <span className="font-body text-[13px] text-brand-muted block">Total Payable</span>
        <span className="font-brand font-black text-[28px] text-brand-red">
          ₹{totalAmount.toFixed(2)}
        </span>
      </div>

      {/* QR Code Container */}
      <div className="flex flex-col items-center justify-center p-4 bg-white border border-brand-border rounded-[16px] shadow-xs max-w-[240px] mx-auto">
        <QRCodeSVG value={upiUrl} size={180} level="M" />
        <span className="font-mono text-[9px] text-brand-muted mt-3 select-all">{upiId}</span>
      </div>

      {/* UPI Logos & Help */}
      <div className="space-y-2">
        <p className="font-brand font-semibold text-[11px] text-brand-body uppercase tracking-wider">
          Scan with GPay, PhonePe, Paytm, or BHIM
        </p>
        <p className="font-body text-[11px] text-brand-muted leading-relaxed">
          Once the payment is successful, click the button below. The staff will verify and clear your table.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {notified ? (
          <div className="w-full bg-green-50 border border-green-200 text-green-700 font-brand font-bold text-[13px] py-3.5 rounded-btn flex items-center justify-center gap-1.5">
            <Check size={16} /> Paid Notification Sent
          </div>
        ) : (
          <button
            onClick={handleNotifyPayment}
            disabled={loading}
            className="w-full bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[13px] uppercase tracking-wider py-3.5 rounded-btn transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-brand-redLight/20 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'I Have Paid'
            )}
          </button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-amber-600 font-body text-[11.5px] bg-amber-50/50 border border-amber-100 p-2.5 rounded-[10px]">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>Paying cash? Tell the waiter or pay at the counter directly.</span>
        </div>
      </div>
    </div>
  )
}
