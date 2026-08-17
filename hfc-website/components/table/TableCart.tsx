'use client'

import React, { useState } from 'react'
import { UtensilsCrossed, MessageSquare } from 'lucide-react'
import { useTableStore } from '@/store/tableStore'

interface TableCartProps {
  tableNumber: string
  isFirstOrder: boolean
  onSuccess: () => void
}

export default function TableCart({ tableNumber, isFirstOrder, onSuccess }: TableCartProps) {
  const cartItems = useTableStore(state => state.cartItems)
  const cartTotal = useTableStore(state => state.getCartTotal())
  const totalItems = useTableStore(state => state.getCartItemCount())
  const placeFirstOrder = useTableStore(state => state.placeFirstOrder)
  const addMoreItems = useTableStore(state => state.addMoreItems)

  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showItems, setShowItems] = useState(false)

  const updateCartQuantity = useTableStore(state => state.updateCartQuantity)

  if (cartItems.length === 0) return null

  const handlePlaceOrder = async () => {
    setIsSubmitting(true)
    let success = false
    if (isFirstOrder) {
      success = await placeFirstOrder(tableNumber, cartItems, notes)
    } else {
      success = await addMoreItems(notes)
    }
    setIsSubmitting(false)
    if (success) {
      setNotes('')
      setShowNotes(false)
      setShowItems(false)
      onSuccess()
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-brand-border shadow-float animate-slide-up">
      {/* 1. Review Cart Items Collapsible Drawer */}
      {showItems && (
        <div className="max-w-md mx-auto mb-4 border-b border-brand-border pb-3.5 space-y-2 max-h-[160px] overflow-y-auto">
          <div className="flex justify-between items-center mb-1">
            <span className="font-brand font-bold text-[11.5px] text-brand-muted uppercase tracking-wider">
              Items in Cart
            </span>
            <button
              onClick={() => setShowItems(false)}
              className="text-[11px] font-brand font-bold text-brand-red hover:underline cursor-pointer"
            >
              Hide List
            </button>
          </div>
          {cartItems.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between text-[13px] bg-brand-surface border border-brand-border p-2 rounded-[8px] animate-fade-in"
            >
              <div className="flex flex-col">
                <span className="font-body font-semibold text-brand-black">{item.name}</span>
                <span className="text-[10px] font-body text-brand-muted">₹{item.price} each</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-brand font-extrabold text-[13.5px] text-brand-black">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </span>
                
                <div className="flex items-center border border-brand-red rounded-[6px] overflow-hidden bg-white shadow-xs">
                  <button
                    onClick={() => updateCartQuantity(item.id, -1)}
                    className="w-5 h-5 flex items-center justify-center bg-brand-red text-white text-[11px] font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-brand font-bold text-[11.5px] text-brand-black min-w-[18px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQuantity(item.id, 1)}
                    className="w-5 h-5 flex items-center justify-center bg-brand-red text-white text-[11px] font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes trigger & input */}
      <div className="max-w-md mx-auto mb-3">
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="flex items-center gap-1.5 text-[12px] font-brand font-bold text-brand-red hover:text-brand-redHover transition-colors cursor-pointer"
          >
            <MessageSquare size={13} />
            <span>Add special instructions (spiciness, allergy, etc.)</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[11.5px] font-brand font-bold text-brand-black flex items-center gap-1">
                <MessageSquare size={12} className="text-brand-red" />
                Cooking Instructions
              </span>
              <button
                onClick={() => {
                  setShowNotes(false)
                  setNotes('')
                }}
                className="text-[11px] font-brand font-bold text-brand-muted hover:text-brand-black cursor-pointer"
              >
                Clear
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="E.g., make it extra spicy, no onions, bring drinks first..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-[12.5px] font-body p-2.5 border border-brand-border rounded-[8px] focus:outline-brand-red bg-[#FAFAFA]"
            />
          </div>
        )}
      </div>

      {/* Cart Summary */}
      <div className="max-w-md mx-auto">
        <div
          onClick={() => setShowItems(!showItems)}
          className="flex items-center justify-between mb-3.5 p-1.5 hover:bg-brand-surface rounded-[10px] transition-all cursor-pointer border border-transparent hover:border-brand-border select-none"
          title="Click to review items"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-redLight text-brand-red flex items-center justify-center">
              <UtensilsCrossed size={14} />
            </div>
            <div className="leading-tight">
              <span className="font-brand font-extrabold text-[14.5px] text-brand-black block">
                {totalItems} item{totalItems > 1 ? 's' : ''} in cart <span className="text-[10px] text-brand-red font-bold">({showItems ? 'Click to Close' : 'Click to View'})</span>
              </span>
              <span className="font-body text-[11.5px] text-brand-muted">
                Dine-in Table {tableNumber}
              </span>
            </div>
          </div>
          <span className="font-brand font-black text-[19px] text-brand-red">
            ₹{cartTotal.toFixed(2)}
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={handlePlaceOrder}
          disabled={isSubmitting}
          className="w-full bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[13.5px] uppercase tracking-[1.5px] py-3.5 rounded-btn transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-redLight/20 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isFirstOrder ? (
            '🍽️ Place Dine-In Order'
          ) : (
            '➕ Send Additional Items'
          )}
        </button>

        <p className="text-center font-body text-[9.5px] text-brand-muted mt-2">
          Your order goes straight to the kitchen.
        </p>
      </div>
    </div>
  )
}
