'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, MapPin, MessageCircle, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useOrderStore, OrderRecord, OrderType, generateOrderId, sanitizeInput } from '@/store/orderStore'
import { usePromotionsStore } from '@/store/promotionsStore'
import { useSettingsStore } from '@/store/settingsStore'
import { openWhatsAppLink } from '@/lib/whatsapp'
import CartItem from './CartItem'
import toast from 'react-hot-toast'

export default function CartDrawer() {
  const router = useRouter()

  const isOpen = useCartStore(state => state.isOpen)
  const closeCart = useCartStore(state => state.closeCart)
  const items = useCartStore(state => state.items)
  const clearCart = useCartStore(state => state.clearCart)
  const getSubtotal = useCartStore(state => state.getSubtotal)

  const addOrder = useOrderStore(state => state.addOrder)

  const getValidCoupon = usePromotionsStore(state => state.getValidCoupon)
  const incrementCouponUsage = usePromotionsStore(state => state.incrementCouponUsage)


  // Multi-step state: 'review' | 'checkout' | 'confirm'
  const [step, setStep] = useState<'review' | 'checkout' | 'confirm'>('review')

  // Form State
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [landmark, setLandmark] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // pendingOrder is set after WhatsApp opens, before order is saved to store
  const [pendingOrder, setPendingOrder] = useState<OrderRecord | null>(null)

  // Coupon State
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [couponError, setCouponError] = useState('')

  const settings = useSettingsStore(state => state.settings)
  const subtotal = getSubtotal()

  // Free delivery threshold evaluated on pre-discount subtotal
  // ALSO waive delivery charge if a free-delivery coupon was applied
  const hasFreeDeliveryCoupon = appliedCoupon?.discountType === 'free-delivery'
  const isFreeDelivery = hasFreeDeliveryCoupon || subtotal >= (settings?.freeDeliveryAbove ?? 500)
  const deliveryCharge = orderType === 'delivery' ? (isFreeDelivery ? 0 : (settings?.deliveryFee ?? 40)) : 0

  // Taxable amount & GST — respects gstMode from Settings:
  //   'exclusive' = GST added ON TOP of subtotal (restaurant standard)
  //   'inclusive' = GST is ALREADY baked into menu prices → NO extra charge at checkout
  //   'none'      = no GST charged
  const gstMode: 'none' | 'inclusive' | 'exclusive' = settings?.gstMode ?? 'exclusive'
  const gstPercent = settings?.gstPercent ?? 5
  const taxableAmount = Math.max(0, subtotal - discountAmount)

  let gst = 0
  if (gstMode === 'exclusive') {
    gst = Math.round(taxableAmount * (gstPercent / 100) * 100) / 100
  } else if (gstMode === 'inclusive') {
    // GST is already in menu prices — nothing to add at checkout
    gst = 0
  } else {
    // gstMode === 'none' — no GST charged
    gst = 0
  }

  // Final Total
  const total = taxableAmount + gst + deliveryCharge
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  const handleApplyCoupon = () => {
    setCouponError('')
    if (!couponCode.trim()) return

    const result = getValidCoupon(couponCode.trim(), subtotal)
    if (result.valid && result.coupon) {
      const coupon = result.coupon
      let calculatedDiscount = 0

      if (coupon.discountType === 'percent') {
        calculatedDiscount = Math.round(subtotal * ((coupon.discountValue || 0) / 100))
        if (coupon.maxDiscountCap && calculatedDiscount > coupon.maxDiscountCap) {
          calculatedDiscount = coupon.maxDiscountCap
        }
      } else if (coupon.discountType === 'flat') {
        calculatedDiscount = coupon.discountValue || 0
      } else if (coupon.discountType === 'free-delivery') {
        calculatedDiscount = 0
      }

      setAppliedCoupon(coupon)
      setDiscountAmount(calculatedDiscount)
    } else {
      setCouponError(result.error || 'Invalid coupon code')
      setAppliedCoupon(null)
      setDiscountAmount(0)
    }
  }

  const handleRemoveCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setDiscountAmount(0)
    setCouponError('')
  }

  const handleClose = () => {
    closeCart()
    setTimeout(() => {
      setStep('review')
      setPendingOrder(null)
      setErrors({})
      setCouponCode('')
      setAppliedCoupon(null)
      setDiscountAmount(0)
      setCouponError('')
    }, 300)
  }

  const scrollToMenu = () => {
    handleClose()
    const el = document.getElementById('menu-section')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  // Geolocation trigger
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      return
    }

    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        setGeoStatus('success')

        // Attempt client-side reverse geocoding via OpenStreetMap Nominatim API
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout fallback

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            {
              signal: controller.signal,
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'HFC-Restaurent-Software-Client/1.0 (info@hfcconsultancy.com)'
              },
            }
          )
          clearTimeout(timeoutId)

          if (res.ok) {
            const data = await res.json()
            if (data && data.display_name) {
              setManualAddress(data.display_name)
              setErrors(prev => ({ ...prev, delivery: '' }))
            }
          }
        } catch (e: any) {
          console.warn('OSM Nominatim geocoding failed or timed out:', e.message || e)
        }
      },
      () => {
        setGeoStatus('error')
      },
      { timeout: 10000 }
    )
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Full name is required'
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length !== 10) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number'
    }

    if (orderType === 'delivery') {
      if (!manualAddress.trim()) {
        newErrors.delivery = 'Delivery address is required'
      }
      if (!landmark.trim()) {
        newErrors.landmark = 'Landmark / House number is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Step 1: Build order + open WhatsApp — pre-save to database in background
  const handleOpenWhatsApp = () => {
    if (!validateForm() || isSubmitting) return
    setIsSubmitting(true)

    const orderId = generateOrderId() // collision-proof

    const newOrder: OrderRecord = {
      id: orderId,
      customerName: sanitizeInput(name),
      phoneNumber: phone.replace(/\D/g, '').slice(-10),
      orderType,
      address: manualAddress ? sanitizeInput(manualAddress) : undefined,
      landmark: landmark ? sanitizeInput(landmark) : undefined,
      coords: coords || undefined,
      items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      subtotal,
      gst,
      deliveryCharge,
      discountAmount: discountAmount > 0 ? discountAmount : 0,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      total,
      paymentMethod: 'Cash',
      paymentStatus: 'unpaid',
      status: 'placed',
      assignedAgent: null,
      seenByAdmin: false,
      isRegularCustomer: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timestamp: Date.now(),
    }

    // Persist order to database immediately in background to prevent lost orders
    try {
      fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      }).then(res => {
        if (!res.ok) console.warn('Pre-save order returned error response')
      }).catch(err => {
        console.warn('Pre-save order network failure:', err)
      })
    } catch (_) {}

    // Open WhatsApp — user must manually tap SEND
    openWhatsAppLink(newOrder)

    // Store pending order + show confirmation screen
    setPendingOrder(newOrder)
    setStep('confirm')
    setIsSubmitting(false)
  }

  // Step 2: User confirms they sent the WhatsApp message
  const handleConfirmSent = async () => {
    if (!pendingOrder || isSubmitting) return
    setIsSubmitting(true)

    let finalOrderToSave = pendingOrder
    let hasServerSuccess = false

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: pendingOrder }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.order) {
          finalOrderToSave = data.order
          hasServerSuccess = true
        }
      } else {
        // Error response from server — LOG ONLY, never break the user flow.
        // We still save the order locally (finalOrderToSave = pendingOrder) below.
        try {
          const errData = await res.json()
          console.warn('Server order validation returned (swallowed):', errData?.error)
        } catch (_) {}
      }
    } catch (err: any) {
      // Network / fetch failure — LOG ONLY, never break flow.
      console.warn('Order API network issue (swallowed):', err)
    }

    // Now save to store (ALWAYS HAPPENS — NO RETURN / EXIT ABOVE)
    addOrder(finalOrderToSave)

    // Increment coupon used count (client optimistic sync)
    if (appliedCoupon) {
      incrementCouponUsage(appliedCoupon.code)
    }

    // Clear cart + close + navigate to tracker
    clearCart()
    const orderId = finalOrderToSave.id

    // Only ONE toast ever shown: ALWAYS SUCCESS — redirect to tracker regardless.
    toast.success(hasServerSuccess
      ? 'Order confirmed! Redirecting to tracker...'
      : 'Order saved locally! Redirecting to tracker...'
    )

    setIsSubmitting(false)
    handleClose()
    router.push(`/track/${orderId}`)
  }

  // Step 2 alt: User wants to try again
  const handleRetrySend = () => {
    if (pendingOrder) openWhatsAppLink(pendingOrder)
  }

  // Legacy alias kept for any remaining usages
  const handleConfirmAndSendWhatsApp = handleOpenWhatsApp

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
          />
        )}
      </AnimatePresence>

      {/* Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ ease: [0.76, 0, 0.24, 1], duration: 0.35 }}
            className="fixed inset-y-0 right-0 h-full w-[440px] max-w-full bg-white z-50 flex flex-col shadow-drawer border-l border-brand-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-brand-border bg-white flex-shrink-0">
              {step === 'review' ? (
                <div className="flex items-center gap-2">
                  <ShoppingBag size={20} className="text-brand-red" />
                  <h2 className="font-display font-bold text-[22px] text-brand-black">
                    Your Selected Order
                  </h2>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep('review')}
                    className="p-1 text-brand-black hover:text-brand-red transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="font-display font-bold text-[20px] text-brand-black">
                    Almost there — a few details
                  </h2>
                </div>
              )}

              <button
                onClick={handleClose}
                className="font-body text-[13px] text-brand-body hover:text-brand-red transition-colors flex items-center gap-1 p-1"
              >
                <X size={18} /> Close
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="text-[52px] mb-3">🍽️</div>
                  <h3 className="font-display font-bold text-[20px] text-brand-black">
                    Your cart is empty
                  </h3>
                  <p className="font-body text-[14px] text-brand-body mt-2 max-w-[240px] leading-relaxed">
                    Add your favourite dishes from our menu above.
                  </p>
                  <button
                    onClick={scrollToMenu}
                    className="mt-6 border-2 border-brand-red text-brand-red font-brand font-semibold text-[12px] uppercase tracking-[1.5px] px-6 py-3 rounded-btn hover:bg-brand-red hover:text-white transition-all duration-200"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : step === 'review' ? (
                /* STEP 1: CART REVIEW */
                <div className="space-y-4">
                  {items.map(item => (
                    <CartItem key={item.id} item={item} />
                  ))}

                  {/* Highlighted Total Bar */}
                  <div className="mt-6 p-4 rounded-card bg-brand-redLight border border-[rgba(204,0,0,0.12)] space-y-2">
                    <div className="flex justify-between font-body text-[13px] text-brand-body">
                      <span>Subtotal</span>
                      <span className="text-brand-black font-semibold">₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {gstMode === 'exclusive' && gst > 0 && (
                      <div className="flex justify-between font-body text-[13px] text-brand-body">
                        <span>GST ({gstPercent}%)</span>
                        <span className="text-brand-black font-semibold">₹{gst.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {gstMode === 'inclusive' && (
                      <div className="flex justify-between font-body text-[12px] text-brand-muted italic">
                        <span>GST ({gstPercent}%)</span>
                        <span>Already in menu prices</span>
                      </div>
                    )}
                    {orderType === 'delivery' && (
                      <div className="flex justify-between font-body text-[13px] text-brand-body">
                        <span>Delivery charge {hasFreeDeliveryCoupon ? '(FREEBY coupon applied)' : isFreeDelivery ? `(orders above ₹${settings?.freeDeliveryAbove ?? 500})` : ''}</span>
                        <span className={deliveryCharge > 0 ? 'text-brand-black font-semibold' : 'text-green-700 font-semibold'}>
                          {deliveryCharge > 0 ? `₹${deliveryCharge.toLocaleString('en-IN')}` : 'FREE'}
                        </span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between font-body text-[13px] text-green-700">
                        <span>Discount ({appliedCoupon?.code})</span>
                        <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="pt-2 mt-2 border-t border-[rgba(204,0,0,0.15)] flex items-center justify-between">
                      <span className="font-brand font-bold text-[16px] text-brand-black">Total:</span>
                      <span className="font-brand font-black text-[22px] text-brand-red">
                        ₹ {total.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* STEP 2: CHECKOUT FORM */
                <div className="space-y-5">
                  {/* Collapsed Mini Order Recap */}
                  <div className="p-3 bg-brand-surface rounded-card border border-brand-border flex items-center justify-between font-body text-[13px]">
                    <span className="text-brand-black font-semibold">
                      🛒 {itemCount} items · ₹{total.toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => setStep('review')}
                      className="text-brand-red font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block font-brand font-semibold text-[13px] text-brand-black mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Harish Tangudu"
                      value={name}
                      onChange={e => {
                        setName(e.target.value)
                        setErrors(prev => ({ ...prev, name: '' }))
                      }}
                      className="w-full h-11 px-3.5 border border-brand-border rounded-btn font-body text-[14px] outline-none focus:border-brand-red"
                    />
                    {errors.name && <p className="text-brand-red font-body text-[12px] mt-1">{errors.name}</p>}
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="block font-brand font-semibold text-[13px] text-brand-black mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={e => {
                        setPhone(e.target.value.replace(/\D/g, ''))
                        setErrors(prev => ({ ...prev, phone: '' }))
                      }}
                      className="w-full h-11 px-3.5 border border-brand-border rounded-btn font-body text-[14px] outline-none focus:border-brand-red"
                    />
                    {errors.phone && <p className="text-brand-red font-body text-[12px] mt-1">{errors.phone}</p>}
                  </div>

                  {/* Order Type Segmented Control */}
                  <div>
                    <label className="block font-brand font-semibold text-[13px] text-brand-black mb-2">
                      Order Type *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'dine-in', label: '🍽 Dine-In' },
                        { id: 'takeaway', label: '🛍 Takeaway' },
                        { id: 'delivery', label: '🏠 Delivery' },
                      ].map(type => {
                        const isSelected = orderType === type.id
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setOrderType(type.id as OrderType)}
                            className={`h-11 font-brand font-semibold text-[13px] rounded-pill border transition-all ${
                              isSelected
                                ? 'border-brand-red bg-brand-redLight text-brand-red shadow-sm'
                                : 'border-brand-border bg-white text-brand-body hover:border-brand-red'
                            }`}
                          >
                            {type.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Conditional Delivery Section */}
                  {orderType === 'delivery' ? (
                    <div className="space-y-3 pt-2 border-t border-brand-border">
                      <label className="block font-brand font-semibold text-[13px] text-brand-black">
                        📍 Delivery Location
                      </label>

                      {/* GPS Button */}
                      <button
                        type="button"
                        onClick={captureLocation}
                        className="w-full h-11 border-2 border-brand-black text-brand-black hover:bg-brand-black hover:text-white font-brand font-semibold text-[13px] rounded-btn flex items-center justify-center gap-2 transition-colors"
                      >
                        <MapPin size={16} />
                        {geoStatus === 'loading' ? 'Capturing Location...' : 'Share Your Location'}
                      </button>

                      {geoStatus === 'success' && (
                        <div className="p-2.5 bg-green-50 border border-green-200 rounded-btn text-brand-green font-body text-[12px] flex items-center gap-2">
                          <span>📍 Location captured ✓</span>
                          <span className="text-[10px] opacity-75">
                            ({coords?.lat.toFixed(4)}, {coords?.lng.toFixed(4)})
                          </span>
                        </div>
                      )}

                      {geoStatus === 'error' && (
                        <p className="text-brand-red font-body text-[12px]">
                          Location access denied — please type your address manually below.
                        </p>
                      )}

                      {/* Address Textarea */}
                      <div>
                        <label className="block font-brand font-semibold text-[12px] text-brand-black mb-1">
                          Delivery Address (Street/Area) *
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Labour Colony, Maruthi Nagar, Flat 302"
                          value={manualAddress}
                          onChange={e => {
                            setManualAddress(e.target.value)
                            setErrors(prev => ({ ...prev, delivery: '' }))
                          }}
                          className="w-full p-3 border border-brand-border rounded-btn font-body text-[13px] outline-none focus:border-brand-red"
                        />
                        {errors.delivery && (
                          <p className="text-brand-red font-body text-[12px] mt-1">{errors.delivery}</p>
                        )}
                      </div>

                      {/* Landmark Input */}
                      <div>
                        <label className="block font-brand font-semibold text-[12px] text-brand-black mb-1">
                          Landmark / House No *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. near XYZ shop"
                          value={landmark}
                          onChange={e => {
                            setLandmark(e.target.value)
                            setErrors(prev => ({ ...prev, landmark: '' }))
                          }}
                          className="w-full h-11 px-3.5 border border-brand-border rounded-btn font-body text-[13px] outline-none focus:border-brand-red"
                        />
                        {errors.landmark && (
                          <p className="text-brand-red font-body text-[12px] mt-1">{errors.landmark}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Dine-In / Takeaway Note */
                    <div className="p-3 bg-brand-surface border border-brand-border rounded-card font-body text-[13px] text-brand-body flex items-center gap-2">
                      {orderType === 'takeaway' ? (
                        <span>📍 Pickup at HFC Consultancy Services outlet</span>
                      ) : (
                        <span>🍽 Table service — our staff will assist you</span>
                      )}
                    </div>
                  )}

                  {/* Coupon Code Section */}
                  <div className="pt-2 border-t border-brand-border space-y-2">
                    <label className="block font-brand font-semibold text-[13px] text-brand-black mb-1">
                      🏷️ Coupon Code
                    </label>

                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter coupon code"
                          value={couponCode}
                          onChange={e => {
                            setCouponCode(e.target.value.toUpperCase())
                            setCouponError('')
                          }}
                          className="flex-1 h-11 px-3.5 border border-brand-border rounded-btn font-body text-[14px] outline-none focus:border-brand-red uppercase font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          className="h-11 px-4 bg-brand-black text-white hover:bg-brand-red font-brand font-semibold text-[12px] uppercase rounded-btn transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-btn text-brand-green font-body text-[13px] flex items-center justify-between">
                        <span>
                          ✓ <strong>{appliedCoupon.code}</strong> applied — Saved ₹{discountAmount}!
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-brand-red font-semibold hover:underline text-[12px]"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {couponError && (
                      <p className="text-brand-red font-body text-[12px] mt-1">
                        ⚠️ {couponError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {items.length > 0 && (
              <div className="p-6 border-t border-brand-border bg-brand-surface space-y-3 flex-shrink-0">
                {step === 'review' ? (
                  <>
                    <button
                      onClick={() => setStep('checkout')}
                      className="w-full h-[52px] bg-brand-red hover:bg-brand-redHover text-white font-brand font-semibold text-[14px] uppercase tracking-[1.5px] rounded-btn transition-all duration-200 shadow-sm"
                    >
                      Review & Send Order
                    </button>
                    <button
                      onClick={handleClose}
                      className="w-full h-[44px] border border-brand-black text-brand-black hover:bg-brand-black hover:text-white font-brand font-semibold text-[12px] uppercase tracking-[1px] rounded-btn transition-colors"
                    >
                      Keep Browsing Menu
                    </button>
                  </>
                ) : step === 'confirm' ? (
                  // WhatsApp Confirmation Step — order NOT yet saved
                  <>
                    <div className="bg-[#f0fdf4] border border-green-200 rounded-[10px] p-4 text-center">
                      <div className="text-[28px] mb-1">💬</div>
                      <p className="font-brand font-bold text-[14px] text-brand-black mb-1">
                        WhatsApp is open!
                      </p>
                      <p className="font-body text-[12px] text-brand-body leading-relaxed">
                        Tap <strong>Send</strong> in WhatsApp to submit your order to HFC.<br />
                        Come back here once sent.
                      </p>
                    </div>
                    <button
                      onClick={handleConfirmSent}
                      disabled={isSubmitting}
                      className="w-full h-[52px] bg-[#166534] hover:bg-[#14532d] text-white font-brand font-bold text-[14px] uppercase tracking-[1px] rounded-btn transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Verifying Order...
                        </>
                      ) : (
                        '✓ Yes, I sent the message'
                      )}
                    </button>
                    <button
                      onClick={handleRetrySend}
                      disabled={isSubmitting}
                      className="w-full h-[44px] border border-brand-border text-brand-body hover:border-brand-black hover:text-brand-black font-brand font-semibold text-[12px] uppercase tracking-[1px] rounded-btn transition-colors disabled:opacity-50"
                    >
                      ↩ No, open WhatsApp again
                    </button>
                    <button
                      onClick={() => { setStep('checkout'); setPendingOrder(null) }}
                      className="w-full text-center font-body text-[11px] text-brand-muted hover:text-brand-red underline py-0.5"
                    >
                      ← Go back and change my order
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleOpenWhatsApp}
                      disabled={isSubmitting}
                      className="w-full h-[52px] bg-brand-whatsapp hover:bg-[#1da851] text-white font-brand font-semibold text-[14px] uppercase tracking-[1.5px] rounded-btn transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <MessageCircle size={18} />
                      {isSubmitting ? 'Generating Order...' : '💬 Send Order via WhatsApp'}
                    </button>
                    <button
                      onClick={() => setStep('review')}
                      className="w-full text-center font-body text-[12px] text-brand-body hover:text-brand-red underline py-1"
                    >
                      ← Back to cart
                    </button>
                  </>
                )}

                {/* Reassurance Line */}
                <p className="font-body text-[11px] text-brand-muted text-center leading-relaxed">
                  🔒 No online payment required on website. Pay cash or UPI on delivery/pickup. We&apos;ll confirm your order on WhatsApp before prep starts.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
