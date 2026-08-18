'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { format, subDays, differenceInMinutes } from 'date-fns'
import { AlertCircle, Star, TrendingUp, Zap, Award, Target, Clock, Package } from 'lucide-react'
import { useAgentAuthStore } from '@/store/agentAuthStore'
import { useOrderStore } from '@/store/orderStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAgentsStore } from '@/store/agentsStore'
import { fetchAgentsFromSupabase, fetchOrdersFromSupabase, subscribeToAllOrdersRealtime } from '@/lib/supabaseSync'
import { supabase } from '@/lib/supabase'
import AdminBadge from '@/components/admin/shared/AdminBadge'

// ─── Types ─────────────────────────────────────────────────────────────────
interface DeliveryRating {
  id: string
  order_id: string
  rating: number
  feedback_text?: string
  rated_at: string
  agent_name: string
}

// ─── Star display helper ───────────────────────────────────────────────────
function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </span>
  )
}

// ─── Score Ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)))
  const color = clamped >= 75 ? '#166534' : clamped >= 50 ? '#D97706' : '#DC2626'
  const r = 48
  const circ = 2 * Math.PI * r
  const dash = (clamped / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="transparent" stroke="#F3F4F6" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r}
          fill="transparent"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
        <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>{clamped}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#6A6A6A">/ 100</text>
      </svg>
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, colorCls = 'text-brand-black', icon }: {
  label: string; value: string | number; sub?: string; colorCls?: string; icon?: React.ReactNode
}) {
  return (
    <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-sm">
      {icon && <div className="mb-2 text-brand-muted">{icon}</div>}
      <div className={`font-brand font-black text-[30px] leading-none ${colorCls}`}>{value}</div>
      <div className="font-body text-[13px] text-brand-muted mt-1">{label}</div>
      {sub && <div className="font-body text-[11px] text-brand-muted mt-0.5 opacity-70">{sub}</div>}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentReportPage() {
  const getLoggedInAgent = useAgentAuthStore(state => state.getLoggedInAgent)
  const agent = getLoggedInAgent()
  const orders = useOrderStore(state => state.orders)
  const upsertOrders = useOrderStore(state => state.upsertOrders)
  const upsertOrder = useOrderStore(state => state.upsertOrder)
  const settings = useSettingsStore(state => state.settings)
  const fetchAndSyncSettings = useSettingsStore(state => state.fetchAndSyncSettings)

  const [ratings, setRatings] = useState<DeliveryRating[]>([])
  const [ratingsLoaded, setRatingsLoaded] = useState(false)

  // Sync everything on mount
  useEffect(() => {
    fetchAndSyncSettings()
    fetchAgentsFromSupabase().then(fetched => {
      if (fetched?.length) useAgentsStore.setState({ agents: fetched })
    })
    fetchOrdersFromSupabase().then(fetched => upsertOrders(fetched))

    const unsub = subscribeToAllOrdersRealtime(updatedOrder => upsertOrder(updatedOrder))
    return () => unsub()
  }, [upsertOrders, upsertOrder, fetchAndSyncSettings])

  // Fetch ratings from Supabase for this agent
  useEffect(() => {
    if (!agent) return
    supabase
      .from('delivery_ratings')
      .select('*')
      .eq('agent_name', agent.name)
      .order('rated_at', { ascending: false })
      .then(({ data }) => {
        setRatings((data as DeliveryRating[]) || [])
        setRatingsLoaded(true)
      })
  }, [agent])

  // Date filter defaults
  const defaultFrom = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  }, [])
  const defaultTo = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom)
  const [appliedTo, setAppliedTo] = useState(defaultTo)
  const [dateError, setDateError] = useState('')

  const perOrderRate = useMemo(() => {
    if (!agent) return 30
    return (agent as any).deliveryRate ?? settings?.riderFlatFee ?? 30
  }, [settings, agent])

  // ─── Computed Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!agent) return {
      assignedCount: 0, deliveredCount: 0, deliveredValue: 0, totalEarnings: 0,
      todayEarnings: 0, completionRate: 100, onTimeCount: 0, onTimePct: 0,
      avgRating: 0, riderScore: 0, tableRows: []
    }

    const fromTime = appliedFrom ? new Date(appliedFrom).setHours(0, 0, 0, 0) : 0
    const toTime = appliedTo ? new Date(appliedTo).setHours(23, 59, 59, 999) : Infinity

    const agentOrders = orders.filter(o => o.assignedAgent === agent.name)
    const filtered = agentOrders.filter(o => {
      const t = new Date(o.createdAt).getTime()
      return t >= fromTime && t <= toTime
    })

    const delivered = filtered.filter(o => o.status === 'delivered')
    const deliveredValue = delivered.reduce((s, o) => s + o.total, 0)
    const totalEarnings = delivered.reduce((s, o) => s + (o.riderEarning || perOrderRate), 0)

    const todayStr = new Date().toISOString().split('T')[0]
    const todayEarnings = agentOrders
      .filter(o => o.status === 'delivered' && o.createdAt.startsWith(todayStr))
      .reduce((s, o) => s + (o.riderEarning || perOrderRate), 0)

    const completionRate = filtered.length > 0 ? Math.round((delivered.length / filtered.length) * 100) : 100

    // On-Time: delivered before (pickedUpAt + estimatedDeliveryMinutes)
    let onTimeCount = 0
    delivered.forEach(o => {
      if (o.pickedUpAt && o.updatedAt && o.estimatedDeliveryMinutes) {
        const pickup = new Date(o.pickedUpAt).getTime()
        const delivered = new Date(o.updatedAt).getTime()
        const etaMs = (o.estimatedDeliveryMinutes + 5) * 60 * 1000 // +5 min grace
        if ((delivered - pickup) <= etaMs) onTimeCount++
      }
    })
    const onTimePct = delivered.length > 0 ? Math.round((onTimeCount / delivered.length) * 100) : 100

    // Avg rating
    const agentRatings = ratings.filter(r => r.agent_name === agent.name)
    const avgRating = agentRatings.length > 0
      ? agentRatings.reduce((s, r) => s + r.rating, 0) / agentRatings.length
      : 0

    // Volume score
    const target = settings?.riderTargetVolume ?? 20
    const volumeScore = Math.min(100, (delivered.length / target) * 100)

    // Rider Score: 40% on-time + 40% ratings + 20% volume
    const riderScore = (onTimePct * 0.4) + ((avgRating / 5) * 100 * 0.4) + (volumeScore * 0.2)

    return {
      assignedCount: filtered.length,
      deliveredCount: delivered.length,
      deliveredValue,
      totalEarnings,
      todayEarnings,
      completionRate,
      onTimeCount,
      onTimePct,
      avgRating,
      riderScore,
      tableRows: [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  }, [orders, agent, appliedFrom, appliedTo, perOrderRate, ratings, settings])

  // ─── 7-Day Bar Chart ────────────────────────────────────────────────────
  const last7Days = useMemo(() => {
    if (!agent) return []
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      return { date: format(d, 'dd MMM'), dateStr: format(d, 'yyyy-MM-dd'), count: 0, earnings: 0 }
    })
    orders.filter(o => o.assignedAgent === agent.name && o.status === 'delivered').forEach(o => {
      const ds = o.createdAt.split('T')[0]
      const day = days.find(d => d.dateStr === ds)
      if (day) { day.count++; day.earnings += (o.riderEarning || perOrderRate) }
    })
    return days
  }, [orders, agent, perOrderRate])

  const maxBarVal = Math.max(...last7Days.map(d => d.count), 1)

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    if (fromDate && toDate && toDate < fromDate) { setDateError('To date must be after From date'); return }
    setDateError('')
    setAppliedFrom(fromDate)
    setAppliedTo(toDate)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="font-display font-bold text-[26px] text-brand-black">My Report</h1>
        <p className="font-body text-[13px] text-brand-muted mt-0.5">Your performance, earnings & ratings overview</p>
      </div>

      {/* Date Filter */}
      <form onSubmit={handleFilter} className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1px] mb-1.5">From</label>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDateError('') }}
            className="w-[160px] h-[42px] border border-brand-border rounded-[6px] px-3 font-body text-[13px] focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 bg-white" />
        </div>
        <div>
          <label className="block font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1px] mb-1.5">To</label>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDateError('') }}
            className={`w-[160px] h-[42px] border rounded-[6px] px-3 font-body text-[13px] focus:outline-none bg-white ${dateError ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-brand-border focus:border-brand-red focus:ring-2 focus:ring-brand-red/10'}`} />
        </div>
        <button type="submit" className="bg-brand-red text-white font-brand font-bold text-[13px] uppercase tracking-[1px] h-[42px] px-6 rounded-[8px] hover:bg-brand-redHover transition-colors cursor-pointer">Filter</button>
        {dateError && (
          <div className="flex items-center gap-1.5 text-brand-red font-body text-[12px] font-semibold">
            <AlertCircle size={14} />{dateError}
          </div>
        )}
      </form>

      {/* ─── Stat Cards Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <StatCard label="Assigned" value={stats.assignedCount} icon={<Package size={16} />} />
        <StatCard label="Delivered" value={stats.deliveredCount} icon={<TrendingUp size={16} />} colorCls="text-brand-red" />
        <StatCard label="Today's Earnings" value={`₹${stats.todayEarnings.toLocaleString('en-IN')}`} icon={<Zap size={16} />} colorCls="text-green-700" />
        <StatCard label="Period Earnings" value={`₹${stats.totalEarnings.toLocaleString('en-IN')}`} sub={`₹${perOrderRate}/order`} icon={<TrendingUp size={16} />} colorCls="text-green-700" />
        <StatCard label="On-Time" value={`${stats.onTimePct}%`} sub={`${stats.onTimeCount}/${stats.deliveredCount} trips`} icon={<Clock size={16} />} colorCls={stats.onTimePct >= 80 ? 'text-[#166534]' : stats.onTimePct >= 60 ? 'text-amber-600' : 'text-red-600'} />
        <StatCard label="Avg Rating" value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'} sub={`${ratings.length} reviews`} icon={<Star size={16} />} colorCls="text-amber-500" />
      </div>

      {/* ─── Rider Score + 7-Day Chart ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rider Score */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm flex flex-col items-center text-center">
          <Award size={18} className="text-brand-muted mb-2" />
          <h3 className="font-display font-bold text-[15px] text-brand-black mb-1">Rider Score</h3>
          <p className="font-body text-[12px] text-brand-muted mb-4">Composite performance rating</p>
          <ScoreRing score={stats.riderScore} />
          <div className="mt-5 w-full space-y-2 text-[12px] font-body text-brand-muted border-t border-brand-border pt-4">
            <div className="flex items-center justify-between">
              <span>On-Time (40%)</span>
              <span className="font-semibold text-brand-black">{stats.onTimePct}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ratings (40%)</span>
              <span className="font-semibold text-brand-black">{stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)}/5` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Volume (20%)</span>
              <span className="font-semibold text-brand-black">{stats.deliveredCount}/{settings?.riderTargetVolume ?? 20}</span>
            </div>
          </div>
        </div>

        {/* 7-Day Volume Chart */}
        <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-[15px] text-brand-black">Last 7 Days</h3>
              <p className="font-body text-[12px] text-brand-muted">Daily delivery volume</p>
            </div>
            <Target size={16} className="text-brand-muted" />
          </div>
          <div className="flex items-end gap-2 h-[140px] pt-4">
            {last7Days.map((day) => {
              const heightPct = maxBarVal > 0 ? (day.count / maxBarVal) * 100 : 0
              return (
                <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
                  <span className="font-brand font-bold text-[10px] text-brand-black">{day.count > 0 ? day.count : ''}</span>
                  <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                    <div
                      className="w-full bg-brand-red rounded-t-[4px] transition-all duration-500"
                      style={{ height: `${Math.max(heightPct, day.count > 0 ? 8 : 2)}%`, opacity: day.count === 0 ? 0.15 : 1 }}
                    />
                  </div>
                  <span className="font-body text-[9px] text-brand-muted text-center leading-tight">{day.date}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Customer Ratings ─────────────────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
        <h3 className="font-display font-bold text-[15px] text-brand-black mb-4">Customer Ratings</h3>
        {!ratingsLoaded ? (
          <div className="py-6 text-center font-body text-[13px] text-brand-muted">Loading ratings...</div>
        ) : ratings.length === 0 ? (
          <div className="py-6 text-center">
            <Star size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="font-body text-[13px] text-brand-muted">No customer ratings yet. Delivered orders will show ratings here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Average Row */}
            <div className="flex items-center gap-3 pb-3 border-b border-brand-border">
              <span className="font-brand font-black text-[36px] text-amber-500">{stats.avgRating.toFixed(1)}</span>
              <div>
                <StarDisplay rating={stats.avgRating} size={18} />
                <p className="font-body text-[12px] text-brand-muted mt-0.5">{ratings.length} total reviews</p>
              </div>
            </div>
            {/* Individual Reviews */}
            {ratings.slice(0, 8).map(r => (
              <div key={r.id} className="flex items-start gap-3 py-2 border-b border-brand-border last:border-0">
                <StarDisplay rating={r.rating} size={13} />
                <div className="flex-1">
                  {r.feedback_text && <p className="font-body text-[13px] text-brand-black leading-snug">{r.feedback_text}</p>}
                  <span className="font-body text-[11px] text-brand-muted">{r.order_id} · {format(new Date(r.rated_at), 'dd MMM, h:mm aa')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Orders Table ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-[12px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-brand-border">
                {['Order', 'Date', 'Customer', 'Total', 'Earning', 'Status'].map(h => (
                  <th key={h} className="font-brand font-semibold text-[10px] text-[#6A6A6A] uppercase tracking-[1.2px] px-5 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {stats.tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 font-body text-[14px] text-brand-muted">No orders found for this date range.</td>
                </tr>
              ) : stats.tableRows.map(order => (
                <tr key={order.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap font-mono font-bold text-[13px] text-brand-black">{order.id}</td>
                  <td className="px-5 py-4 whitespace-nowrap font-body text-[13px] text-brand-black">{format(new Date(order.createdAt), 'dd MMM, h:mm aa')}</td>
                  <td className="px-5 py-4 font-brand font-semibold text-[13px] text-brand-black">{order.customerName}</td>
                  <td className="px-5 py-4 whitespace-nowrap font-brand font-bold text-[14px] text-brand-black">₹{order.total.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4 whitespace-nowrap font-brand font-bold text-[14px] text-green-700">
                    {order.status === 'delivered' ? `₹${(order.riderEarning || perOrderRate).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap"><AdminBadge variant="status" value={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
