'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { ShoppingCart, UtensilsCrossed } from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import { useCartStore } from '@/store/cartStore'
import TableMenuBrowser from '@/components/table/TableMenuBrowser'
import CounterCheckout from '@/components/counter/CounterCheckout'
import CounterPaymentQR from '@/components/counter/CounterPaymentQR'
import CounterTokenTracker from '@/components/counter/CounterTokenTracker'

type PageState = 'menu' | 'checkout' | 'payment' | 'tracker'

export default function CounterOrderPage() {
  const [pageState, setPageState] = useState<PageState>('menu')
  const [notes, setNotes] = useState('')
  const [orderId, setOrderId] = useState('')
  const [tokenNumber, setTokenNumber] = useState('')

  const settings = useSettingsStore(state => state.settings)
  const fetchAndSyncSettings = useSettingsStore(state => state.fetchAndSyncSettings)
  const items = useCartStore(state => state.items)
  const clearCart = useCartStore(state => state.clearCart)

  useEffect(() => {
    fetchAndSyncSettings()
  }, [fetchAndSyncSettings])

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const packagingCharge = settings.packagingCharge ?? 10
  const gstPercent = settings.gstPercent ?? 5
  const gst = Math.round(subtotal * (gstPercent / 100) * 100) / 100
  const total = subtotal + packagingCharge + gst

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const handlePaid = (newOrderId: string, newToken: string) => {
    setOrderId(newOrderId)
    setTokenNumber(newToken)
    clearCart()
    setPageState('tracker')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header — only show on menu/checkout/payment states */}
      {pageState !== 'tracker' && (
        <div className="sticky top-0 z-50 bg-white border-b border-brand-border shadow-xs">
          <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.jpeg"
                width={32}
                height={32}
                className="rounded-full border border-brand-border"
                alt="HFC Logo"
              />
              <div>
                <span className="font-brand font-black text-[14px] text-brand-red tracking-tight">HFC</span>
                <span className="font-body text-[10px] text-brand-muted block leading-none">Self Service</span>
              </div>
            </div>

            {/* Counter Badge */}
            <div className="flex items-center gap-1.5 bg-amber-500 text-white rounded-full px-3.5 py-1">
              <UtensilsCrossed size={12} />
              <span className="font-brand font-bold text-[12px]">Counter Takeaway</span>
            </div>

            {/* Cart indicator — only on menu state */}
            {pageState === 'menu' && itemCount > 0 && (
              <div className="flex items-center gap-1 bg-brand-surface border border-brand-border rounded-full px-2.5 py-1">
                <ShoppingCart size={12} className="text-brand-red" />
                <span className="font-brand font-bold text-[11px] text-brand-black">{itemCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATE: MENU */}
      {pageState === 'menu' && (
        <div>
          {/* Announcement strip */}
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
            <p className="font-brand font-semibold text-[11.5px] text-amber-800">
              🥡 Counter Takeaway — Pay via UPI, collect your order at the counter when called
            </p>
          </div>

          {/* Menu browser (reused from table system) */}
          <TableMenuBrowser />

          {/* Floating cart checkout bar */}
          {itemCount > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-brand-border max-w-md mx-auto">
              <button
                onClick={() => setPageState('checkout')}
                className="w-full bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[14px] uppercase tracking-[1px] py-4 rounded-btn flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
              >
                <ShoppingCart size={17} />
                {itemCount} {itemCount === 1 ? 'Item' : 'Items'} · ₹{subtotal.toFixed(0)} · Checkout →
              </button>
            </div>
          )}
        </div>
      )}

      {/* STATE: CHECKOUT SUMMARY */}
      {pageState === 'checkout' && (
        <CounterCheckout
          items={items}
          packagingCharge={packagingCharge}
          gstPercent={gstPercent}
          onBack={() => setPageState('menu')}
          onProceedToPay={() => setPageState('payment')}
        />
      )}

      {/* STATE: PAYMENT QR */}
      {pageState === 'payment' && (
        <CounterPaymentQR
          total={total}
          upiId={settings.upiId || '9912799855@okbizaxis'}
          siteName={settings.siteName || 'HFC Restaurant'}
          items={items}
          notes={notes}
          packagingCharge={packagingCharge}
          gst={gst}
          subtotal={subtotal}
          onBack={() => setPageState('checkout')}
          onPaid={handlePaid}
        />
      )}

      {/* STATE: TOKEN TRACKER */}
      {pageState === 'tracker' && orderId && (
        <CounterTokenTracker
          orderId={orderId}
          tokenNumber={tokenNumber}
          items={items.length > 0 ? items : []}
          total={total}
        />
      )}
    </div>
  )
}
