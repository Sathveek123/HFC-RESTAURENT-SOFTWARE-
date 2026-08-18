'use client'

import { use, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ArrowLeft, MapPin, CheckCircle, AlertCircle, RefreshCw, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { useOrderStore, OrderRecord, OrderStatus } from '@/store/orderStore'
import { useSettingsStore } from '@/store/settingsStore'
import { subscribeToOrderRealtime, fetchSingleOrderRPC } from '@/lib/supabaseSync'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import TrackerErrorBoundaryFallback from '@/components/tracker/TrackerErrorBoundaryFallback'


interface TrackPageProps {
  params: Promise<{ orderId: string }>
}

// ─── STEPPER CONFIG ──────────────────────────────────────────────────────────

const ALL_STAGES: { key: OrderStatus; label: string }[] = [
  { key: 'placed',     label: 'Order Placed' },
  { key: 'accepted',  label: 'Order Accepted' },
  { key: 'ready',     label: 'Order Ready' },
  { key: 'picked-up', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
]

function getVisibleStages(orderType: string) {
  if (orderType === 'delivery') return ALL_STAGES
  // dine-in / takeaway: skip "Picked Up" stage
  return ALL_STAGES.filter(s => s.key !== 'picked-up')
}

function getStageState(
  stageKey: OrderStatus,
  currentStatus: OrderStatus,
  visibleStages: typeof ALL_STAGES
): 'completed' | 'current' | 'upcoming' {
  const order = visibleStages.map(s => s.key)
  const currentIdx = order.indexOf(currentStatus)
  const stageIdx = order.indexOf(stageKey)
  if (stageIdx < currentIdx) return 'completed'
  if (stageIdx === currentIdx) return 'current'
  return 'upcoming'
}

// ─── STATUS CONTEXT MESSAGE ───────────────────────────────────────────────────

function getStatusMessage(status: OrderStatus, orderType: string): string {
  switch (status) {
    case 'placed':
      return "We've received your order and are reviewing it. This page updates once HFC accepts."
    case 'accepted':
      return 'HFC has accepted your order and is preparing it now.'
    case 'ready':
      if (orderType === 'delivery') return 'Your order is ready! Our delivery partner will pick it up shortly.'
      return 'Your order is ready! Please collect it at our counter.'
    case 'picked-up':
      return 'Your order is on its way! Our delivery partner has picked it up.'
    case 'delivered':
      return '🎉 Delivered! We hope you enjoyed your meal.'
    case 'rejected':
      return ''
    case 'cancelled':
      return ''
    default:
      return ''
  }
}

// ─── CUSTOMER RATING PROMPT ─────────────────────────────────────────────────

function RatingPrompt({ orderId, agentName }: { orderId: string; agentName: string }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a star rating'); return }
    setSubmitting(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('submit_delivery_rating', {
        p_order_id: orderId,
        p_rating: rating,
        p_feedback: feedback.trim() || null
      })
      if (rpcError) throw rpcError
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to submit rating. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-card p-5 shadow-card text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <CheckCircle size={24} className="text-green-700" />
        </div>
        <h3 className="font-brand font-bold text-[15px] text-green-800 mb-1">Thanks for your feedback!</h3>
        <p className="font-body text-[13px] text-green-700">Your rating helps us improve our service.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-border rounded-card p-6 shadow-card">
      <h3 className="font-brand font-bold text-[16px] text-brand-black mb-1">Rate your delivery</h3>
      <p className="font-body text-[13px] text-brand-muted mb-4">
        How was your experience with <strong className="text-brand-black">{agentName}</strong>?
      </p>

      {/* Star Selector */}
      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110 cursor-pointer"
          >
            <Star
              size={32}
              className={`transition-colors ${
                star <= (hovered || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="font-brand font-bold text-[13px] text-brand-black ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
          </span>
        )}
      </div>

      {/* Feedback Text */}
      <textarea
        rows={2}
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="Any comments? (optional)"
        className="w-full border border-brand-border rounded-[8px] px-3 py-2.5 font-body text-[13px] text-brand-black resize-none focus:outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 transition-all mb-3"
      />

      {error && (
        <p className="font-body text-[12px] text-red-600 mb-2 flex items-center gap-1">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[42px] px-6 rounded-btn hover:bg-brand-redHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TrackOrderPage({ params }: TrackPageProps) {
  const { orderId } = use(params)
  return (
    <ErrorBoundary fallback={<TrackerErrorBoundaryFallback orderId={orderId} />}>
      <TrackOrderPageInner orderId={orderId} />
    </ErrorBoundary>
  )
}

function TrackOrderPageInner({ orderId }: { orderId: string }) {
  const getOrderById = useOrderStore(state => state.getOrderById)
  const updatePaymentStatus = useOrderStore(state => state.updatePaymentStatus)
  const settings = useSettingsStore(state => state.settings)

  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [order, setOrder] = useState<OrderRecord | undefined>(undefined)
  const [justUpdated, setJustUpdated] = useState(false)
  const prevStatusRef = useRef<OrderStatus | undefined>(undefined)

  // ─── Instant Supabase Realtime Subscription + Polling fallback ──────────
  useEffect(() => {
    setMounted(true)

    // Try to get from local store first to show immediate cached order details
    const localOrder = getOrderById(orderId)
    if (localOrder) {
      setOrder(localOrder)
      prevStatusRef.current = localOrder.status
      setIsLoading(false)
    }

    // 1. Initial RPC single-order fetch (SECURITY DEFINER — prevents bulk DB dumps!)
    fetchSingleOrderRPC(orderId).then(remoteOrder => {
      if (remoteOrder) {
        setOrder(remoteOrder)
        prevStatusRef.current = remoteOrder.status
      }
      setIsLoading(false)
    }).catch((err) => {
      console.error('Failed to fetch order details:', err)
      setIsLoading(false)
    })

    const handleUpdate = (latest: OrderRecord) => {
      if (latest && latest.status !== prevStatusRef.current) {
        setOrder({ ...latest })
        prevStatusRef.current = latest.status

        // Show "Updated" flash
        setJustUpdated(true)
        setTimeout(() => setJustUpdated(false), 3000)

        // COD auto-pay on delivery
        if (
          latest.status === 'delivered' &&
          latest.orderType === 'delivery' &&
          (latest.paymentMethod === 'Cash' || latest.paymentMethod === undefined) &&
          latest.paymentStatus !== 'paid'
        ) {
          updatePaymentStatus(orderId, 'paid')
        }
      } else if (latest) {
        setOrder({ ...latest })
      }
    }

    // 2. LocalStorage poll (fallback)
    const poll = () => {
      const latest = getOrderById(orderId)
      if (latest) handleUpdate(latest)
    }

    const interval = setInterval(poll, 6000)

    // 3. Instant Supabase Realtime WebSockets
    const unsubscribeRealtime = subscribeToOrderRealtime(orderId, (updatedOrder) => {
      handleUpdate(updatedOrder)
    })

    return () => {
      clearInterval(interval)
      unsubscribeRealtime()
    }
  }, [orderId, getOrderById, updatePaymentStatus])

  // ─── MOUNT / LOADING STATE (Avoids hydration mismatch) ────────────────────

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-brand-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-red mb-4"></div>
        <p className="font-body text-[14px] text-brand-body">Loading your order details...</p>
      </div>
    )
  }

  // ─── ORDER NOT FOUND ─────────────────────────────────────────────────────────

  if (!order) {
    return (
      <div className="min-h-screen bg-brand-surface flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display font-bold text-[28px] text-brand-black mb-2">Order Not Found</h2>
        <p className="font-body text-[14px] text-brand-body mb-6">
          We couldn&apos;t find an order matching <strong className="text-brand-red">{orderId}</strong>.
        </p>
        <Link
          href="/"
          className="bg-brand-red text-white font-brand font-semibold text-[13px] uppercase tracking-wider px-6 py-3 rounded-btn"
        >
          Return to Menu
        </Link>
      </div>
    )
  }

  const currentStatus = order.status

  // ─── CANCELLED / REJECTED BANNER ────────────────────────────────────────────

  if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-brand-surface py-12 px-4 sm:px-6">
        <div className="max-w-[720px] mx-auto space-y-6">
          <Link href="/" className="inline-flex items-center gap-2 font-body text-[13px] text-brand-body hover:text-brand-red transition-colors">
            <ArrowLeft size={16} /> Back to Menu
          </Link>

          <div className="bg-white border border-brand-border rounded-card p-6 shadow-card">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h2 className="font-display font-bold text-[22px] text-brand-black mb-2">
                {currentStatus === 'cancelled' ? 'Order Cancelled' : 'Order Rejected'}
              </h2>
              <p className="font-body text-[14px] text-brand-muted max-w-[400px] mx-auto">
                {currentStatus === 'cancelled'
                  ? 'This order was cancelled. Contact HFC for more details.'
                  : 'This order was rejected by HFC. Please contact us for clarification.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <a
                  href={`tel:+${settings.phone}`}
                  className="bg-brand-black text-white font-brand font-semibold text-[13px] uppercase tracking-wider px-6 py-3 rounded-btn inline-flex items-center gap-2 justify-center"
                >
                  <Phone size={16} /> Call HFC
                </a>
                <Link
                  href="/"
                  className="border-2 border-brand-black text-brand-black font-brand font-semibold text-[13px] uppercase tracking-wider px-6 py-3 rounded-btn inline-flex items-center justify-center"
                >
                  🛍 Order Again
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── VISIBLE STAGES (4 for dine-in/takeaway, 5 for delivery) ────────────────

  const visibleStages = getVisibleStages(order.orderType)
  const statusMessage = getStatusMessage(currentStatus, order.orderType)

  const upiId = settings.upiId || '9912799855@okbizaxis'
  const phone = settings.phone || '9912799855'
  const whatsappNumber = settings.whatsappNumber || '919912799855'
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(settings.siteName || 'HFC Consultancy Services')}&am=${order.total}&cu=INR`

  const isDelivered = currentStatus === 'delivered'
  const isCashOrder = order.paymentMethod === 'Cash' || !order.paymentMethod
  const isPaid = order.paymentStatus === 'paid'

  const statusBadgeMap: Record<OrderStatus, string> = {
    'placed':    'bg-gray-100 text-gray-700 border-gray-300',
    'accepted':  'bg-blue-50 text-blue-700 border-blue-200',
    'ready':     'bg-amber-50 text-amber-700 border-amber-200',
    'picked-up': 'bg-teal-50 text-teal-700 border-teal-200',
    'delivered': 'bg-[#166534] text-white border-[#166534]',
    'rejected':  'bg-red-50 text-red-700 border-red-200',
    'cancelled': 'bg-gray-50 text-gray-500 border-gray-200',
  }

  return (
    <div className="min-h-screen bg-brand-surface py-12 px-4 sm:px-6">
      <div className="max-w-[720px] mx-auto space-y-6">

        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-2 font-body text-[13px] text-brand-body hover:text-brand-red transition-colors">
          <ArrowLeft size={16} /> Back to Menu
        </Link>

        {/* "Updated" Toast Flash */}
        <AnimatePresence>
          {justUpdated && (
            <motion.div
              key="updated-toast"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-50 border border-green-200 rounded-[8px] px-4 py-2.5 flex items-center gap-2 font-brand font-semibold text-[13px] text-green-700"
            >
              <RefreshCw size={14} className="text-green-600" />
              Order status updated ✓
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Card — Order ID + Status Badge */}
        <div className="bg-white border border-brand-border rounded-card p-6 shadow-card flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="font-body text-[11px] uppercase tracking-[1px] text-brand-muted block">ORDER ID</span>
            <h1 className="font-brand font-black text-[24px] text-brand-black tracking-tight mt-0.5">
              {order.id}
            </h1>
            <p className="font-body text-[12px] text-brand-muted mt-1">
              Placed on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <span className={`px-4 py-1.5 rounded-pill font-brand font-bold text-[12px] uppercase tracking-[1px] border ${statusBadgeMap[currentStatus]}`}>
            {currentStatus === 'delivered' ? 'Delivered' : currentStatus === 'picked-up' ? 'Out for Delivery' : currentStatus.replace('-', ' ')}
          </span>
        </div>

        {/* ─── 5-Stage Stepper ─────────────────────────────────────────────── */}
        <div className="bg-white border border-brand-border rounded-card p-6 shadow-card">
          <h3 className="font-brand font-semibold text-[14px] text-brand-black mb-6 uppercase tracking-wider">
            Live Order Status
          </h3>

          {/* Stepper Row */}
          <div className="flex items-start justify-between min-w-0 relative px-2 overflow-x-auto pb-2">
            {visibleStages.map((stage, idx) => {
              const state = getStageState(stage.key, currentStatus, visibleStages)
              const isCompleted = state === 'completed'
              const isCurrent = state === 'current'
              const isLast = idx === visibleStages.length - 1

              return (
                <div key={stage.key} className="flex flex-col items-center relative flex-1 min-w-[72px]">
                  {/* Connecting line (before this dot, bridging to previous) */}
                  {idx > 0 && (
                    <div
                      className={`absolute top-4 right-[calc(50%+16px)] left-[calc(-50%+16px)] h-[3px] -z-0 transition-colors duration-700 ${
                        isCompleted || isCurrent ? 'bg-brand-red' : 'bg-brand-border'
                      }`}
                    />
                  )}

                  {/* Dot */}
                  <div className="relative z-10">
                    {/* Pulse ring for current */}
                    {isCurrent && (
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.15, 0.6] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                        className="absolute inset-0 bg-brand-red rounded-full"
                      />
                    )}
                    {/* Dot */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-brand font-bold text-[12px] transition-all duration-500 relative z-10 ${
                        isCompleted
                          ? 'bg-brand-red text-white'
                          : isCurrent
                          ? 'bg-brand-red text-white shadow-[0_0_0_4px_rgba(204,0,0,0.15)]'
                          : 'bg-white border-2 border-brand-border text-brand-muted'
                      }`}
                    >
                      {isCompleted ? (
                        isLast && isDelivered ? (
                          <CheckCircle size={16} />
                        ) : (
                          <CheckCircle size={16} />
                        )
                      ) : isCurrent && isLast && isDelivered ? (
                        <CheckCircle size={16} />
                      ) : (
                        idx + 1
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <span
                    className={`font-brand text-[10px] mt-3 uppercase tracking-tight text-center leading-tight max-w-[72px] ${
                      isCurrent
                        ? 'font-bold text-brand-red'
                        : isCompleted
                        ? 'font-semibold text-brand-black'
                        : 'font-medium text-brand-muted'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status context message */}
          {statusMessage && (
            <p className={`font-body text-[13px] text-center mt-5 leading-relaxed ${isDelivered ? 'text-green-700 font-semibold' : 'text-brand-muted'}`}>
              {statusMessage}
            </p>
          )}
        </div>

        {/* ─── Order Details Card ───────────────────────────────────────────── */}
        <div className="bg-white border border-brand-border rounded-card p-6 shadow-card space-y-4">
          <h3 className="font-brand font-bold text-[16px] text-brand-black border-b border-brand-border pb-3">
            Order & Customer Info
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-body text-[13px]">
            <div>
              <span className="text-brand-muted block">Customer Name:</span>
              <strong className="text-brand-black">{order.customerName}</strong>
            </div>
            <div>
              <span className="text-brand-muted block">Phone Number:</span>
              <strong className="text-brand-black">{order.phoneNumber}</strong>
            </div>
            <div>
              <span className="text-brand-muted block">Order Type:</span>
              <strong className="text-brand-black uppercase">{order.orderType?.replace('-', ' ')}</strong>
            </div>
            {order.assignedAgent && currentStatus === 'picked-up' && (
              <div>
                <span className="text-brand-muted block">Delivery Agent:</span>
                <strong className="text-brand-black">{order.assignedAgent}</strong>
              </div>
            )}
            {order.coords && (
              <div>
                <span className="text-brand-muted block">GPS Pin:</span>
                <a
                  href={`https://www.google.com/maps?q=${order.coords.lat},${order.coords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-red font-semibold underline inline-flex items-center gap-1"
                >
                  <MapPin size={13} /> View Map Pin
                </a>
              </div>
            )}
          </div>

          {order.address && (
            <div className="text-[13px] bg-brand-surface p-3 rounded-btn border border-brand-border">
              <span className="text-brand-muted block font-semibold">Delivery Address:</span>
              <span className="text-brand-black">{order.address}</span>
            </div>
          )}

          {/* Items */}
          <div className="pt-2 border-t border-brand-border space-y-2">
            <h4 className="font-brand font-semibold text-[14px] text-brand-black mb-2">Dishes Ordered:</h4>
            {order.items.map(item => (
              <div key={item.id} className="flex justify-between font-body text-[13px]">
                <span>{item.quantity} × {item.name}</span>
                <span className="font-semibold text-brand-black">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="pt-3 border-t border-brand-border space-y-1 font-body text-[14px]">
            <div className="flex justify-between text-brand-body">
              <span>Subtotal</span>
              <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {order.gst > 0 && (
              <div className="flex justify-between text-brand-body">
                <span>GST</span>
                <span>₹{order.gst.toLocaleString('en-IN')}</span>
              </div>
            )}
            {order.deliveryCharge !== undefined && order.deliveryCharge > 0 && (
              <div className="flex justify-between text-brand-body">
                <span>Delivery Charge</span>
                <span>₹{order.deliveryCharge.toLocaleString('en-IN')}</span>
              </div>
            )}
            {order.discountAmount !== undefined && order.discountAmount > 0 && (
              <div className="flex justify-between text-green-700 font-semibold">
                <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                <span>-₹{order.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 font-brand font-bold text-[18px] text-brand-black border-t border-brand-border">
              <span>Total Amount</span>
              <span className="text-brand-red">₹{order.total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Payment Status Row */}
          <div className={`flex items-center justify-between p-3 rounded-[8px] border text-[13px] font-body ${
            isPaid ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <span className={`font-semibold ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
              Payment: {order.paymentMethod || 'Cash'}
            </span>
            <span className={`font-brand font-bold text-[12px] uppercase ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
              {isPaid ? '✓ Paid' : 'Pending'}
            </span>
          </div>
        </div>

        {/* ─── Payment Block: UPI QR or Cash Received ─────────────────────── */}
        {isDelivered && isCashOrder ? (
          /* Cash delivered — transaction closed */
          <div className="bg-white border border-brand-border rounded-card p-6 shadow-card text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-green-700" />
            </div>
            <h3 className="font-brand font-bold text-[16px] text-brand-black mb-1">
              Cash Payment Received
            </h3>
            <p className="font-body text-[13px] text-brand-muted">
              ₹{order.total.toLocaleString('en-IN')} collected by delivery agent. Thank you!
            </p>
          </div>
        ) : !isPaid && settings.upiId ? (
          /* UPI QR — payment pending */
          <div className="bg-white border border-brand-border rounded-card p-6 shadow-card text-center flex flex-col items-center">
            <h3 className="font-brand font-bold text-[16px] text-brand-black mb-1">
              📱 UPI Scan-to-Pay
            </h3>
            <p className="font-body text-[13px] text-brand-muted mb-4">
              Scan with PhonePe, Google Pay, or Paytm to complete payment
            </p>
            <div className="p-4 bg-white border border-brand-border rounded-card shadow-sm inline-block">
              <QRCodeSVG value={upiUrl} size={180} level="M" />
            </div>
            <p className="font-brand font-bold text-[16px] text-brand-red mt-4">
              Scan to pay ₹{order.total.toLocaleString('en-IN')}
            </p>
          </div>
        ) : isPaid && !isCashOrder ? (
          /* Online paid — confirmed */
          <div className="bg-white border border-green-200 rounded-card p-5 shadow-card text-center">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 px-4 py-2 rounded-full text-green-700 font-brand font-bold text-[13px]">
              <CheckCircle size={16} /> Online Payment Confirmed
            </div>
          </div>
        ) : null}

        {/* ─── Post-Delivery Customer Rating ────────────────────────────────── */}
        {isDelivered && order.assignedAgent && (
          <RatingPrompt orderId={order.id} agentName={order.assignedAgent} />
        )}

        {/* Bottom CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <a
            href={`tel:+${phone}`}
            className="flex-1 h-[48px] bg-brand-black text-white hover:bg-brand-red font-brand font-semibold text-[13px] uppercase tracking-[1px] rounded-btn flex items-center justify-center gap-2 transition-colors"
          >
            <Phone size={16} /> Call HFC Consultancy Services
          </a>
          <Link
            href="/"
            className="flex-1 h-[48px] border-2 border-brand-black text-brand-black hover:bg-brand-black hover:text-white font-brand font-semibold text-[13px] uppercase tracking-[1px] rounded-btn flex items-center justify-center gap-2 transition-colors text-center"
          >
            🛍 Order Again
          </Link>
        </div>

        <p className="font-body text-[11px] text-brand-muted text-center leading-relaxed">
          Order updates are shown based on latest team confirmations. For urgent queries, call or{' '}
          <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="text-brand-red underline">
            WhatsApp us directly
          </a>.
        </p>

      </div>
    </div>
  )
}
