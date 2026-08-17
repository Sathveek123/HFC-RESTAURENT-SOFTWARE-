'use client'

import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { MapPin, Bike, PackageCheck, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAgentAuthStore } from '@/store/agentAuthStore'
import { useAgentsStore } from '@/store/agentsStore'
import { useOrderStore, OrderRecord } from '@/store/orderStore'
import { subscribeToAllOrdersRealtime, fetchOrdersFromSupabase } from '@/lib/supabaseSync'
import AdminBadge from '@/components/admin/shared/AdminBadge'

export default function AgentOrdersPage() {
  const getLoggedInAgent = useAgentAuthStore(state => state.getLoggedInAgent)
  const agent = getLoggedInAgent()

  const orders = useOrderStore(state => state.orders)
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus)
  const updatePaymentStatus = useOrderStore(state => state.updatePaymentStatus)
  const upsertOrders = useOrderStore(state => state.upsertOrders)
  const upsertOrder = useOrderStore(state => state.upsertOrder)
  const upsertAgents = useAgentsStore(state => state.upsertAgents)

  // Realtime Supabase sync — runs ONCE on mount only
  React.useEffect(() => {
    fetchOrdersFromSupabase().then(fetched => {
      upsertOrders(fetched)
    })

    const unsubscribe = subscribeToAllOrdersRealtime((updatedOrder) => {
      upsertOrder(updatedOrder)
    })

    return () => unsubscribe()
  }, [upsertOrders, upsertOrder])


  // Status Filter Tabs
  const [activeTab, setActiveTab] = useState<'new' | 'out' | 'delivered' | 'all'>('new')

  // Date Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  // Inline Confirmation for Cash Delivery
  const [confirmCashOrderId, setConfirmCashOrderId] = useState<string | null>(null)

  // Filter orders by agent name
  const agentOrders = useMemo(() => {
    if (!agent) return []
    return orders.filter(o => o.assignedAgent === agent.name)
  }, [orders, agent])

  // Count for New Assignments — both accepted and ready orders
  const newAssignmentsCount = useMemo(() => {
    return agentOrders.filter(o => o.status === 'accepted' || o.status === 'ready').length
  }, [agentOrders])

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    let result = [...agentOrders]

    // 1. Status Filter
    if (activeTab === 'new') {
      // Show accepted AND ready — both mean the agent can start the delivery
      result = result.filter(o => o.status === 'accepted' || o.status === 'ready')
    } else if (activeTab === 'out') {
      result = result.filter(o => o.status === 'picked-up')
    } else if (activeTab === 'delivered') {
      result = result.filter(o => o.status === 'delivered')
    }

    // 2. Date Filter
    if (appliedFrom) {
      const fromTime = new Date(appliedFrom).setHours(0, 0, 0, 0)
      result = result.filter(o => new Date(o.createdAt).getTime() >= fromTime)
    }
    if (appliedTo) {
      const toTime = new Date(appliedTo).setHours(23, 59, 59, 999)
      result = result.filter(o => new Date(o.createdAt).getTime() <= toTime)
    }

    // Sort by timestamp DESC
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [agentOrders, activeTab, appliedFrom, appliedTo])

  // Action: Start Delivery
  const handleStartDelivery = (orderId: string) => {
    updateOrderStatus(orderId, 'picked-up')
    toast.success('Order marked as Out for Delivery ✓')
  }

  // Action: Mark Delivered
  const handleMarkDelivered = (order: OrderRecord) => {
    if (order.paymentMethod === 'Cash' && order.paymentStatus !== 'paid') {
      setConfirmCashOrderId(order.id)
      return
    }
    executeDelivery(order)
  }

  const executeDelivery = (order: OrderRecord) => {
    updateOrderStatus(order.id, 'delivered')
    if (order.paymentMethod === 'Cash' && order.paymentStatus !== 'paid') {
      updatePaymentStatus(order.id, 'paid')
    }
    setConfirmCashOrderId(null)
    toast.success('Delivered ✓ Payment marked as Paid')
  }

  const handleApplyDateFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedFrom(fromDate)
    setAppliedTo(toDate)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-[26px] text-brand-black">My Orders</h1>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'new', label: 'New Assignments', count: newAssignmentsCount },
          { id: 'out', label: 'Out for Delivery' },
          { id: 'delivered', label: 'Delivered' },
          { id: 'all', label: 'All' },
        ].map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2 rounded-[20px] font-brand font-bold text-[13px] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-brand-red text-white'
                  : 'bg-white border border-brand-border text-brand-body hover:border-brand-red hover:text-brand-red'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono animate-pulse ${
                    isActive ? 'bg-white text-brand-red' : 'bg-brand-red text-white'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Date Filter Bar */}
      <form onSubmit={handleApplyDateFilter} className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase mb-1">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="w-[160px] h-[40px] border border-brand-border rounded-[6px] px-3 font-body text-[13px] focus:border-brand-red focus:outline-none bg-white"
          />
        </div>

        <div>
          <label className="block font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase mb-1">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="w-[160px] h-[40px] border border-brand-border rounded-[6px] px-3 font-body text-[13px] focus:border-brand-red focus:outline-none bg-white"
          />
        </div>

        <button
          type="submit"
          className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[40px] px-6 rounded-[6px] hover:bg-brand-redHover transition-colors cursor-pointer"
        >
          Filter
        </button>

        {(appliedFrom || appliedTo) && (
          <button
            type="button"
            onClick={() => {
              setFromDate('')
              setToDate('')
              setAppliedFrom('')
              setAppliedTo('')
            }}
            className="h-[40px] px-3 font-body text-[12px] text-brand-muted hover:text-brand-red underline cursor-pointer"
          >
            Reset Dates
          </button>
        )}
      </form>

      {/* Orders Table Container */}
      <div className="bg-white border border-brand-border rounded-[12px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-brand-border">
                {['Order', 'Customer', 'Address', 'Total', 'Payment', 'Status', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 font-body text-[14px] text-brand-muted">
                    No orders in this range. New assignments from HFC will appear here.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const formattedDate = format(
                    new Date(order.createdAt),
                    'dd MMM, h:mm aa'
                  )

                  return (
                    <React.Fragment key={order.id}>
                      <tr className="hover:bg-[#FAFAFA] transition-colors">
                        {/* 1. ORDER */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <span className="font-mono font-bold text-[13px] text-brand-black block">
                            {order.id}
                          </span>
                          <div className="font-body text-[11px] text-brand-muted mt-1">
                            {formattedDate}
                          </div>
                        </td>

                        {/* 2. CUSTOMER */}
                        <td className="px-5 py-4 align-top">
                          <div className="font-brand font-semibold text-[13px] text-brand-black">
                            {order.customerName}
                          </div>
                          <a
                            href={`tel:${order.phoneNumber}`}
                            onClick={e => e.stopPropagation()}
                            className="font-body text-[11px] text-brand-muted hover:text-brand-red transition-colors block mt-0.5"
                          >
                            {order.phoneNumber}
                          </a>
                        </td>

                        {/* 3. ADDRESS */}
                        <td className="px-5 py-4 align-top max-w-[220px]">
                          <span className="font-body text-[13px] text-brand-black block leading-snug">
                            {order.address || order.deliveryArea}
                          </span>
                          {order.coords && (
                            <a
                              href={`https://www.google.com/maps?q=${order.coords.lat},${order.coords.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 mt-1 font-body text-[12px] text-brand-red hover:underline"
                            >
                              <MapPin size={11} />
                              Open map
                            </a>
                          )}
                        </td>

                        {/* 4. TOTAL */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <span className="font-brand font-bold text-[14px] text-brand-black">
                            ₹{order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* 5. PAYMENT */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <span className="font-body text-[13px] text-brand-black">
                            {order.paymentMethod || 'Cash'}
                          </span>
                          <span className="text-brand-muted mx-1">—</span>
                          <span
                            className={`font-brand font-bold text-[13px] ${
                              order.paymentStatus === 'paid' ? 'text-green-700' : 'text-amber-600'
                            }`}
                          >
                            {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>

                        {/* 6. STATUS */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <AdminBadge variant="status" value={order.status} />
                        </td>

                        {/* 7. ACTIONS */}
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            {(order.status === 'accepted' || order.status === 'ready') && (
                              <button
                                onClick={() => handleStartDelivery(order.id)}
                                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-brand font-bold text-[11px] uppercase px-4 h-[30px] rounded-[6px] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Bike size={12} />
                                Start Delivery
                              </button>
                            )}

                            {order.status === 'picked-up' && (
                              <button
                                onClick={() => handleMarkDelivered(order)}
                                className="bg-[#166534] hover:bg-[#14532D] text-white font-brand font-bold text-[11px] uppercase px-4 h-[30px] rounded-[6px] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <PackageCheck size={12} />
                                Mark Delivered
                              </button>
                            )}

                            {order.status === 'delivered' && (
                              <button
                                onClick={() => window.open(`/track/${order.id}`, '_blank')}
                                className="bg-white border border-brand-red text-brand-red font-brand font-bold text-[11px] uppercase px-4 h-[30px] rounded-[6px] hover:bg-brand-redLight transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ExternalLink size={12} />
                                View bill
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Cash collection confirm expander */}
                      {confirmCashOrderId === order.id && (
                        <tr>
                          <td colSpan={7} className="bg-amber-50 border-t border-b border-amber-200 px-5 py-3">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <span className="font-body text-[13px] text-amber-800">
                                Confirm ₹<strong>{order.total.toFixed(2)}</strong> cash collected for order <strong>{order.id}</strong>?
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => executeDelivery(order)}
                                  className="bg-green-700 hover:bg-green-800 text-white font-brand font-bold text-[11px] uppercase px-4 py-1.5 rounded-[5px] cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmCashOrderId(null)}
                                  className="border border-amber-300 text-amber-800 font-brand font-medium text-[11px] uppercase px-3 py-1.5 rounded-[5px] hover:bg-amber-100 cursor-pointer"
                                >
                                  Not yet
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
