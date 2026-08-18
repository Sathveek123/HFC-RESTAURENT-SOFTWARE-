'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone,
  Copy,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  MapPin,
  Tag,
  Check,
  X,
  MessageCircle,
  UserPlus,
  CheckCheck,
  PackageCheck,
  AlertTriangle,
  Receipt,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useOrderStore, OrderRecord } from '@/store/orderStore'
import OrderStatusBadge from './OrderStatusBadge'
import PaymentDropdown from './PaymentDropdown'
import AgentDropdown from './AgentDropdown'
import NotifyCustomerModal from './NotifyCustomerModal'

interface OrderTableRowProps {
  order: OrderRecord
}

export default function OrderTableRow({ order }: OrderTableRowProps) {
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus)
  const cancelOrder = useOrderStore(state => state.cancelOrder)
  const addToRegularCustomers = useOrderStore(state => state.addToRegularCustomers)
  const duplicateOrder = useOrderStore(state => state.duplicateOrder)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isNotifyOpen, setIsNotifyOpen] = useState(false)

  const customerPhone = order.phoneNumber || ''
  const customerName = order.customerName || ''

  // 1. WhatsApp confirmation links generator
  const handleAccept = () => {
    updateOrderStatus(order.id, 'accepted')
    
    const timeEst = order.orderType === 'delivery' ? '35-45 mins' : '15-20 mins'
    const msg = encodeURIComponent(
      `✅ *Order Confirmed!*\n` +
      `Hi ${customerName}, your order *${order.id}* has been accepted by HFC Consultancy Services.\n` +
      `🕐 Estimated time: ${timeEst}\n` +
      `💰 Total: ₹${order.total}\n` +
      `Track your order: ${window.location.origin}/track/${order.id}\n` +
      `Thank you for ordering! 🍽️`
    )
    
    window.open(`https://wa.me/91${customerPhone.replace(/\D/g, '')}?text=${msg}`, '_blank')
    toast.success('Order accepted ✓ WhatsApp opened for customer')
  }

  const handleMarkDelivered = () => {
    updateOrderStatus(order.id, 'delivered')
    
    const msg = encodeURIComponent(
      `🎉 *Order Delivered!*\n` +
      `Hi ${customerName}, your order *${order.id}* has been successfully delivered!\n` +
      `We hope you enjoy your meal. Thank you for choosing HFC! 🍽️`
    )
    
    window.open(`https://wa.me/91${customerPhone.replace(/\D/g, '')}?text=${msg}`, '_blank')
    toast.success('Order marked Delivered ✓ WhatsApp notification opened')
  }

  const handleAddRegular = () => {
    addToRegularCustomers(order.id)
    toast.success(`Added ${customerName} to regular customers ✓`)
  }

  const handleReorder = () => {
    const dup = duplicateOrder(order.id)
    if (dup) {
      toast.success(`Created duplicate order ${dup.id} successfully!`)
    } else {
      toast.error('Failed to duplicate order')
    }
  }

  const isPlaced = order.status === 'placed'

  return (
    <>
      <tr
        className={`border-b border-brand-border transition-colors duration-150 hover:bg-[#FAFAFA] last:border-0 ${
          isPlaced ? 'bg-[#FFFBF0]' : 'bg-white'
        }`}
      >
        {/* COLUMN 1: ORDER ID + DATE */}
        <td className="px-4 py-4 align-top">
          <div className="flex flex-col gap-1">
            <Link
              href={`/admin/orders/${order.id}`}
              className="font-mono font-bold text-[13px] text-brand-black hover:text-brand-red transition-colors hover:underline leading-tight whitespace-nowrap"
            >
              {order.id}
            </Link>
            <span className="font-body text-[11px] text-brand-muted leading-tight">
              {format(new Date(order.createdAt), 'dd MMM yyyy')}
            </span>
            <span className="font-body text-[11px] text-brand-muted leading-tight">
              {format(new Date(order.createdAt), 'h:mm aa')}
            </span>
          </div>
        </td>

        {/* COLUMN 2: CUSTOMER NAME + PHONE */}
        <td className="px-4 py-4 align-top">
          <div className="flex flex-col gap-1.5">
            <span className="font-brand font-semibold text-[13px] text-brand-black leading-tight flex items-center gap-1">
              {customerName}
              {order.isRegularCustomer && (
                <span className="bg-green-100 text-green-800 border border-green-300 font-brand font-bold text-[8px] px-1.5 py-0.5 rounded">
                  REGULAR
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${customerPhone}`}
                onClick={e => e.stopPropagation()}
                className="font-body text-[11px] text-brand-muted hover:text-brand-red transition-colors flex items-center gap-1"
              >
                <Phone size={10} className="flex-shrink-0" />
                {customerPhone}
              </a>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(customerPhone)
                  toast.success('Phone copied!')
                }}
                className="w-5 h-5 rounded-[4px] border border-brand-border bg-white flex items-center justify-center hover:border-brand-red hover:text-brand-red transition-all text-brand-muted flex-shrink-0"
                title="Copy Phone Number"
              >
                <Copy size={10} />
              </button>
            </div>
          </div>
        </td>

        {/* COLUMN 3: ORDER TYPE */}
        <td className="px-4 py-4 align-top">
          <div className="flex flex-col gap-1">
            {order.orderType === 'dine-in' && (
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-brand font-semibold text-[10px] uppercase tracking-[0.8px] px-2.5 py-1 rounded-[4px] w-fit">
                <UtensilsCrossed size={11} />
                Dine-In
              </span>
            )}
            {order.orderType === 'takeaway' && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 font-brand font-semibold text-[10px] uppercase tracking-[0.8px] px-2.5 py-1 rounded-[4px] w-fit">
                <ShoppingBag size={11} />
                {order.source === 'counter-qr' ? `Counter #${order.tokenNumber || ''}` : 'Takeaway'}
              </span>
            )}
            {order.orderType === 'delivery' && (
              <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 font-brand font-semibold text-[10px] uppercase tracking-[0.8px] px-2.5 py-1 rounded-[4px] w-fit">
                <Bike size={11} />
                Delivery
              </span>
            )}
            {order.orderType === 'delivery' && (order.deliveryArea || order.landmark) && (
              <span className="font-body text-[10px] text-brand-muted flex items-center gap-1 mt-0.5 max-w-[120px] truncate">
                <MapPin size={9} />
                {order.deliveryArea || order.landmark}
              </span>
            )}
          </div>
        </td>

        {/* COLUMN 4: TOTAL (W/ FLASH EFFECT ID) */}
        <td id={`order-total-${order.id}`} className="px-4 py-4 align-top transition-colors duration-500">
          <div className="flex flex-col gap-1">
            <span className="font-brand font-bold text-[15px] text-brand-black whitespace-nowrap">
              ₹{order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="font-body text-[10px] text-brand-muted">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </span>
            {order.couponCode && (
              <span className="font-body text-[10px] text-green-700 flex items-center gap-1">
                <Tag size={9} />
                {order.couponCode}
              </span>
            )}
          </div>
        </td>

        {/* COLUMN 5: PAYMENT STATUS */}
        <td className="px-4 py-4 align-top">
          <PaymentDropdown order={order} />
        </td>

        {/* COLUMN 6: AGENT ASSIGNMENT */}
        <td className="px-4 py-4 align-top">
          <AgentDropdown order={order} />
        </td>

        {/* COLUMN 7: ORDER STATUS PILL */}
        <td className="px-4 py-4 align-top">
          <OrderStatusBadge status={order.status} />
        </td>

        {/* COLUMN 8: ACTIONS */}
        <td className="px-4 py-4 align-top">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Conditional Status Buttons */}
            {order.status === 'placed' && (
              <>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    handleAccept()
                  }}
                  className="bg-brand-red text-white font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-brand-redHover transition-colors flex items-center gap-1.5"
                >
                  <Check size={12} /> Accept
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setShowCancelConfirm(true)
                  }}
                  className="bg-white border border-red-300 text-red-600 font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <X size={12} /> Cancel
                </button>
              </>
            )}

            {order.status === 'accepted' && (
              <>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    updateOrderStatus(order.id, 'ready')
                    toast.success('Order marked Ready ✓')
                  }}
                  className="bg-amber-500 text-white font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-amber-600 transition-colors flex items-center gap-1.5"
                >
                  <CheckCheck size={12} /> Mark Ready
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setShowCancelConfirm(true)
                  }}
                  className="bg-white border border-red-300 text-red-600 font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <X size={12} /> Cancel
                </button>
              </>
            )}

            {order.status === 'ready' && (
              <>
                {order.orderType === 'delivery' ? (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      updateOrderStatus(order.id, 'picked-up')
                      toast.success('Rider dispatched with order ✓')
                    }}
                    className="bg-[#7C3AED] text-white font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-[#6D28D9] transition-colors flex items-center gap-1.5"
                  >
                    <Bike size={12} /> Out for Delivery
                  </button>
                ) : (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleMarkDelivered()
                    }}
                    className="bg-[#166534] text-white font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-[#14532D] transition-colors flex items-center gap-1.5"
                  >
                    <PackageCheck size={12} /> Mark Delivered
                  </button>
                )}
              </>
            )}

            {order.status === 'picked-up' && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  handleMarkDelivered()
                }}
                className="bg-[#166534] text-white font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-[#14532D] transition-colors flex items-center gap-1.5"
              >
                <PackageCheck size={12} /> Mark Delivered
              </button>
            )}

            {/* Notify button visible for all in-progress stages */}
            {['placed', 'accepted', 'ready', 'picked-up'].includes(order.status) && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  setIsNotifyOpen(true)
                }}
                className="bg-[#25D366] text-white font-brand font-bold text-[11px] uppercase tracking-[0.8px] px-4 h-[30px] rounded-[6px] hover:bg-[#1da851] transition-colors flex items-center gap-1.5"
              >
                <MessageCircle size={12} /> Notify
              </button>
            )}

            {/* Customer regular tag list shortcut */}
            {['placed', 'accepted'].includes(order.status) && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  handleAddRegular()
                }}
                disabled={order.isRegularCustomer}
                className={`font-brand font-semibold text-[11px] px-3 h-[30px] rounded-[6px] transition-all flex items-center gap-1.5 border ${
                  order.isRegularCustomer
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-white border-brand-border text-brand-black hover:border-brand-black hover:bg-[#F5F5F5]'
                }`}
              >
                <UserPlus size={12} />
                {order.isRegularCustomer ? '✓ Regular' : '+ Regular'}
              </button>
            )}

            {/* Finished states actions */}
            {['delivered', 'cancelled', 'rejected'].includes(order.status) && (
              <>
                <Link
                  href={`/admin/bills?highlight=${order.id}`}
                  className="bg-white border border-brand-border text-brand-black font-brand font-semibold text-[11px] px-3 h-[30px] rounded-[6px] hover:border-brand-black hover:bg-[#F5F5F5] transition-all inline-flex items-center gap-1.5"
                >
                  <Receipt size={12} /> View Bill
                </Link>
                {order.status === 'delivered' && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleReorder()
                    }}
                    className="bg-white border border-brand-border text-brand-black font-brand font-semibold text-[11px] px-3 h-[30px] rounded-[6px] hover:border-brand-black hover:bg-[#F5F5F5] transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={12} /> Reorder
                  </button>
                )}
              </>
            )}
          </div>

          {/* Inline Expandable Cancel Confirmation Row */}
          <AnimatePresence>
            {showCancelConfirm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
                onClick={e => e.stopPropagation()}
              >
                <div className="bg-red-50 border border-red-200 rounded-[8px] p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <span className="font-body text-[12px] text-red-700">
                      Cancel this order? This cannot be undone.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        cancelOrder(order.id)
                        setShowCancelConfirm(false)
                        toast.success('Order cancelled')
                      }}
                      className="bg-red-600 text-white font-brand font-bold text-[10px] px-3 py-1.5 rounded-[5px] hover:bg-red-700 transition-colors uppercase"
                    >
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="border border-red-300 text-red-600 font-brand font-medium text-[10px] px-3 py-1.5 rounded-[5px] hover:bg-red-50 transition-colors uppercase bg-white"
                    >
                      Never mind
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      </tr>

      {/* Notify customer modal overlay context */}
      <NotifyCustomerModal
        isOpen={isNotifyOpen}
        onClose={() => setIsNotifyOpen(false)}
        order={order}
      />
    </>
  )
}
