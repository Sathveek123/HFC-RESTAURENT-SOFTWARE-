'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingBag, Clock, IndianRupee } from 'lucide-react'
import { useOrderStore } from '@/store/orderStore'
import { useAgentsStore } from '@/store/agentsStore'
import { subscribeToAllOrdersRealtime, fetchOrdersFromSupabase, fetchAgentsFromSupabase, subscribeToAgentsRealtime } from '@/lib/supabaseSync'
import OrdersFilterTabs from '@/components/admin/orders/OrdersFilterTabs'
import OrdersSearchBar from '@/components/admin/orders/OrdersSearchBar'
import OrdersTable from '@/components/admin/orders/OrdersTable'

export default function AdminOrdersListPage() {
  const orders = useOrderStore(state => state.orders)
  const markSeenByAdmin = useOrderStore(state => state.markSeenByAdmin)
  const upsertOrders = useOrderStore(state => state.upsertOrders)
  const upsertOrder = useOrderStore(state => state.upsertOrder)
  const upsertAgents = useAgentsStore(state => state.upsertAgents)

  // Fetch delivery agents to sync dropdown on mount & listen to realtime updates
  useEffect(() => {
    fetchAgentsFromSupabase().then(fetched => {
      if (fetched && fetched.length > 0) {
        upsertAgents(fetched)
      }
    })

    const unsubscribe = subscribeToAgentsRealtime(
      (changedAgent) => {
        upsertAgents([changedAgent])
      },
      (deletedId) => {
        useAgentsStore.setState({
          agents: useAgentsStore.getState().agents.filter(a => a.id !== deletedId)
        })
      }
    )

    return () => unsubscribe()
  }, [upsertAgents])


  // Filters State
  const [activeTab, setActiveTab] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [orderTypeFilter, setOrderTypeFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')

  // Pagination State
  const [page, setPage] = useState(1)
  const pageSize = 10

  // 1. Mark all current matching unseen orders as seen on mount/render
  useEffect(() => {
    const unseenIds = orders.filter(o => !o.seenByAdmin).map(o => o.id)
    if (unseenIds.length > 0) {
      markSeenByAdmin(unseenIds)
    }
  }, [orders, markSeenByAdmin])

  // 2. Calculations for page stats header
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  
  const todayOrders = orders.filter(
    o => new Date(o.createdAt).getTime() >= startOfToday.getTime()
  )

  const todayOrderCount = todayOrders.length
  const newOrderCount = orders.filter(o => o.status === 'placed').length
  
  const todayRevenue = todayOrders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + o.total, 0)

  // 3. Filter orders based on status, search, and advanced filters
  let filtered = [...orders]

  // Tab Filter
  const statusTabs = [
    { id: 'active',           label: 'Active',           statuses: ['placed', 'accepted', 'ready', 'picked-up'] },
    { id: 'new',              label: 'New',              statuses: ['placed'] },
    { id: 'accepted',         label: 'Accepted',         statuses: ['accepted'] },
    { id: 'ready',            label: 'Ready',            statuses: ['ready'] },
    { id: 'out-for-delivery', label: 'Out for Delivery', statuses: ['picked-up'] },
    { id: 'delivered',        label: 'Delivered',        statuses: ['delivered'] },
    { id: 'cancelled',        label: 'Cancelled',        statuses: ['cancelled', 'rejected'] },
    { id: 'all',              label: 'All',              statuses: [] },
  ]
  const currentTab = statusTabs.find(t => t.id === activeTab)
  if (currentTab && currentTab.statuses.length > 0) {
    filtered = filtered.filter(o => currentTab.statuses.includes(o.status))
  }

  // Search Query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    const cleanQ = q.replace('+91', '').trim()
    filtered = filtered.filter(o => {
      const matchId = o.id.toLowerCase().includes(q)
      const matchName = o.customerName.toLowerCase().includes(q)
      const phoneStr = (o.phoneNumber || '').replace(/\D/g, '')
      const matchPhone = phoneStr.includes(cleanQ)
      return matchId || matchName || matchPhone
    })
  }

  // Advanced Filters
  if (fromDate) {
    const fDate = new Date(fromDate)
    fDate.setHours(0, 0, 0, 0)
    filtered = filtered.filter(o => new Date(o.createdAt).getTime() >= fDate.getTime())
  }
  if (toDate) {
    const tDate = new Date(toDate)
    tDate.setHours(23, 59, 59, 999)
    filtered = filtered.filter(o => new Date(o.createdAt).getTime() <= tDate.getTime())
  }
  if (orderTypeFilter !== 'all') {
    filtered = filtered.filter(o => o.orderType === orderTypeFilter)
  }
  if (paymentStatusFilter !== 'all') {
    filtered = filtered.filter(o => o.paymentStatus === paymentStatusFilter)
  }

  // 4. Pagination calculations
  const totalCount = filtered.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const paginatedOrders = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="flex flex-col gap-0 p-6 md:p-8 bg-[#FAFAFA] min-h-full">
      {/* LAYER 1: PAGE HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
        <h1 className="font-display font-bold text-[28px] text-brand-black">
          Orders
        </h1>

        {/* Live stats chips */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Total today */}
          <div className="flex items-center gap-2 bg-white border border-brand-border rounded-[8px] px-4 py-2">
            <ShoppingBag size={14} className="text-brand-red" />
            <span className="font-brand font-semibold text-[12px] text-brand-black whitespace-nowrap">
              {todayOrderCount} today
            </span>
          </div>

          {/* Pending action */}
          <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FDE68A] rounded-[8px] px-4 py-2">
            <Clock size={14} className="text-amber-500" />
            <span className="font-brand font-semibold text-[12px] text-amber-700 whitespace-nowrap">
              {newOrderCount} pending
            </span>
          </div>

          {/* Revenue */}
          <div className="flex items-center gap-2 bg-white border border-brand-border rounded-[8px] px-4 py-2">
            <IndianRupee size={14} className="text-brand-red" />
            <span className="font-brand font-semibold text-[12px] text-brand-black whitespace-nowrap">
              ₹{todayRevenue.toLocaleString('en-IN')} today
            </span>
          </div>
        </div>
      </div>

      {/* LAYER 2: STATUS FILTER TABS */}
      <OrdersFilterTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orders={orders}
        setSearchQuery={setSearchQuery}
        setPage={setPage}
      />

      {/* LAYER 3: SEARCH BAR + ADVANCED FILTER EXPANSION */}
      <OrdersSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        orderTypeFilter={orderTypeFilter}
        setOrderTypeFilter={setOrderTypeFilter}
        paymentStatusFilter={paymentStatusFilter}
        setPaymentStatusFilter={setPaymentStatusFilter}
        filteredCount={totalCount}
        totalCount={orders.length}
      />

      {/* LAYER 4: ORDERS RESPONSIVE TABLE GRID */}
      <OrdersTable orders={paginatedOrders} />

      {/* LAYER 5: PAGINATION FOOTER */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 border-t border-brand-border pt-4">
          <span className="font-body text-[12px] text-brand-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 border border-brand-border text-brand-black hover:border-brand-black rounded-[8px] bg-white font-brand font-semibold text-[11px] uppercase tracking-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 border border-brand-border text-brand-black hover:border-brand-black rounded-[8px] bg-white font-brand font-semibold text-[11px] uppercase tracking-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
