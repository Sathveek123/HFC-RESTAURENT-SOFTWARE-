'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  ChefHat, Clock, CheckCircle2, History,
  Maximize2, Minimize2, BellRing,
  Lock, Unlock, ShieldAlert, ClipboardList,
  UtensilsCrossed, ShoppingBag, Bike, Moon, Sun
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useOrderStore, OrderRecord } from '@/store/orderStore'
import { fetchOrdersFromSupabase, subscribeToAllOrdersRealtime } from '@/lib/supabaseSync'
import { supabase } from '@/lib/supabase'

// ─── Audio Differentiation Per Order Type ────────────────────────────────────
function playBell(ctx: AudioContext, freq: number, vol: number, delay: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.8)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + 0.8)
}

function playOrderChime(orderType: 'dine-in' | 'takeaway' | 'delivery') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    if (orderType === 'dine-in') {
      playBell(ctx, 880, 0.3, 0)
      playBell(ctx, 660, 0.3, 0.2)
    } else if (orderType === 'takeaway') {
      playBell(ctx, 1047, 0.4, 0)
    } else {
      playBell(ctx, 587, 0.3, 0)
      playBell(ctx, 587, 0.3, 0.1)
      playBell(ctx, 880, 0.4, 0.2)
    }
  } catch (e) {
    console.warn('Audio blocked:', e)
  }
}

// ─── Urgency Border + Timer Styling ─────────────────────────────────────────
function getUrgency(createdAt: string) {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (minutes >= 20) return { border: 'border-red-500 animate-pulse', timer: 'text-red-500', minutes }
  if (minutes >= 10) return { border: 'border-amber-400', timer: 'text-amber-500', minutes }
  return { border: 'border-green-300', timer: 'text-green-600', minutes }
}

// ─── Unified KDS Card ─────────────────────────────────────────────────────────
interface KDSCardProps {
  id: string
  label: string
  subLabel: string
  items: { name: string; quantity: number }[]
  notes?: string | null
  createdAt: string
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  status: string
  bigText: boolean
  darkMode: boolean
  onMarkReady: () => void
  onMarkServed?: () => void
}

function KDSCard({
  id, label, subLabel, items, notes, createdAt,
  orderType, status, bigText, darkMode,
  onMarkReady, onMarkServed
}: KDSCardProps) {
  const urgency = getUrgency(createdAt)
  const relTime = formatDistanceToNow(new Date(createdAt), { addSuffix: true })

  const accentText =
    orderType === 'dine-in' ? 'text-blue-600'
    : orderType === 'takeaway' ? 'text-amber-600'
    : 'text-brand-red'

  const btnBg =
    orderType === 'dine-in' ? 'bg-blue-600 hover:bg-blue-700'
    : orderType === 'takeaway' ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-brand-red hover:bg-brand-redHover'

  const btnLabel =
    orderType === 'dine-in' ? '✓ Food Ready & Packed'
    : orderType === 'takeaway' ? '✓ Ready for Pickup'
    : '✓ Ready for Rider'

  const cardBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-brand-border'
  const headerBg = darkMode ? 'bg-gray-900 border-gray-700' : 'bg-[#FAFAFA] border-brand-border'
  const textPrimary = darkMode ? 'text-white' : 'text-brand-black'
  const textMuted = darkMode ? 'text-gray-400' : 'text-brand-muted'
  const itemBorder = darkMode ? 'border-gray-700' : 'border-brand-border'
  const notesBg = darkMode ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200'
  const notesText = darkMode ? 'text-amber-300' : 'text-amber-800'

  return (
    <div className={`flex flex-col rounded-[14px] border-2 overflow-hidden mb-3 shadow-sm ${urgency.border} ${cardBg}`}>
      {/* Card Header */}
      <div className={`px-4 py-3 border-b ${headerBg} flex items-center justify-between`}>
        <div>
          <span className={`font-brand font-black ${bigText ? 'text-[20px]' : 'text-[15px]'} ${accentText}`}>
            {label}
          </span>
          <span className={`font-body text-[11px] ${textMuted} block mt-0.5`}>{subLabel}</span>
        </div>
        <div className={`flex items-center gap-1 font-brand font-bold text-[12px] ${urgency.timer} ${urgency.minutes >= 20 ? 'animate-pulse' : ''}`}>
          <Clock size={12} />
          {urgency.minutes}m
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex-1">
        <div className={`space-y-2 divide-y ${itemBorder}`}>
          {items.map((item, i) => (
            <div key={i} className={`flex items-center justify-between ${i > 0 ? 'pt-2' : ''}`}>
              <span className={`font-body font-medium ${bigText ? 'text-[16px]' : 'text-[13.5px]'} ${textPrimary} flex-1`}>
                {item.name}
              </span>
              <span className={`font-brand font-black ${bigText ? 'text-[18px]' : 'text-[14px]'} ${textPrimary} ml-3`}>
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>
        {notes && (
          <div className={`mt-3 px-3 py-2 rounded-[6px] border text-[11.5px] font-body ${notesBg} ${notesText}`}>
            📝 {notes}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4">
        {/* For placed table orders: show Accept first */}
        {status === 'placed' ? (
          <button
            onClick={onMarkReady}
            className={`w-full py-3 rounded-btn font-brand font-bold text-[13px] uppercase tracking-[1px] text-white transition-colors cursor-pointer bg-blue-600 hover:bg-blue-700`}
          >
            ✓ Accept Order
          </button>
        ) : (
          <button
            onClick={onMarkReady}
            className={`w-full py-3 rounded-btn font-brand font-bold text-[13px] uppercase tracking-[1px] text-white transition-colors cursor-pointer ${btnBg}`}
          >
            {btnLabel}
          </button>
        )}
        {orderType === 'dine-in' && status !== 'placed' && onMarkServed && (
          <button
            onClick={onMarkServed}
            className={`w-full py-2 mt-2 rounded-btn border-2 border-blue-600 font-brand font-semibold text-[12px] cursor-pointer transition-colors ${
              darkMode ? 'text-blue-400 hover:bg-blue-900/30' : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            ✓ Served at Table
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty Column State ───────────────────────────────────────────────────────
function EmptyColumn({ type, darkMode }: { type: 'dine-in' | 'takeaway' | 'delivery', darkMode: boolean }) {
  const icons = { 'dine-in': '🍽️', 'takeaway': '🥡', 'delivery': '🛵' }
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center opacity-40`}>
      <span className="text-[48px] mb-3">{icons[type]}</span>
      <span className={`font-body text-[13px] ${darkMode ? 'text-gray-400' : 'text-brand-muted'}`}>
        No active {type} orders
      </span>
    </div>
  )
}

// ─── Column Header ────────────────────────────────────────────────────────────
interface ColHeaderProps {
  icon: React.ReactNode
  label: string
  count: number
  bg: string
}

function ColHeader({ icon, label, count, bg }: ColHeaderProps) {
  return (
    <div className={`${bg} text-white rounded-t-[12px] px-4 py-3 flex items-center justify-between sticky top-0 z-10`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-brand font-bold text-[14px] uppercase tracking-[1px]">{label}</span>
      </div>
      <span className="bg-white/30 font-brand font-black text-[13px] rounded-full w-7 h-7 flex items-center justify-center">
        {count}
      </span>
    </div>
  )
}

// ─── Main KDS Page ────────────────────────────────────────────────────────────
export default function KitchenViewPage() {
  const orders = useOrderStore(state => state.orders)
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus)

  const [activeTab, setActiveTab] = useState<'dine-in' | 'takeaway' | 'delivery' | 'history'>('dine-in')
  const [bigTextMode, setBigTextMode] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [timeTicker, setTimeTicker] = useState(0)
  const [tableKots, setTableKots] = useState<any[]>([])

  const [kdsLockPin, setKdsLockPin] = useState<string | null>(null)
  const [isLockingModalOpen, setIsLockingModalOpen] = useState(false)
  const [isUnlockingModalOpen, setIsUnlockingModalOpen] = useState(false)
  const [tempPin, setTempPin] = useState('')
  const [unlockInput, setUnlockInput] = useState('')
  const [unlockError, setUnlockError] = useState(false)

  // Timer for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTimeTicker(p => p + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  // Fetch + subscribe to table KOTs
  useEffect(() => {
    const fetchTableKots = async () => {
      try {
        const { data: cooking } = await supabase
          .from('table_orders')
          .select('id, session_id, table_number, round_number, items, status, kot_number, special_instructions, placed_at')
          .in('status', ['accepted'])

        const { data: history } = await supabase
          .from('table_orders')
          .select('id, session_id, table_number, round_number, items, status, kot_number, special_instructions, placed_at, served_at')
          .in('status', ['ready', 'served'])
          .order('placed_at', { ascending: false })
          .limit(12)

        setTableKots([...(cooking || []), ...(history || [])])
      } catch (err) {
        console.warn('Failed to fetch table KOTs:', err)
      }
    }

    fetchTableKots()

    const ch = supabase
      .channel('kds-table-kots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_orders' }, fetchTableKots)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  // Sync orders store so KDS shows counter/delivery orders in real-time
  useEffect(() => {
    const upsertOrders = useOrderStore.getState().upsertOrders
    const upsertOrder = useOrderStore.getState().upsertOrder
    fetchOrdersFromSupabase().then(fetched => upsertOrders(fetched))
    const unsub = subscribeToAllOrdersRealtime(updatedOrder => upsertOrder(updatedOrder))
    return () => unsub()
  }, [])

  // ─── Build 3 buckets ────────────────────────────────────────────────────────
  const sortByOldest = (a: any, b: any) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

  const dineInOrders = useMemo(() => {
    return tableKots
      .filter(k => k.status === 'accepted')
      .map(k => ({
        id: k.id,
        label: `TABLE ${k.table_number}`,
        subLabel: `Round ${k.round_number} · KOT: ${k.kot_number}`,
        items: k.items || [],
        notes: k.special_instructions,
        createdAt: k.placed_at,
        status: k.status,
        isTableKot: true,
      }))
      .sort(sortByOldest)
  }, [tableKots])

  const takeawayOrders = useMemo(() => {
    return orders
      .filter(o =>
        // Show both 'placed' and 'accepted' so counter QR orders appear immediately
        ['placed', 'accepted'].includes(o.status) &&
        (o.orderType === 'takeaway' ||
         ((o.notes || '').toLowerCase().includes('counter-qr')) ||
         ((o as any).source === 'counter-qr')
        )
      )
      .map(o => ({
        id: o.id,
        label: `#${(o as any).tokenNumber || o.id.slice(-6).toUpperCase()}`,
        subLabel: o.status === 'placed' ? '🆕 Awaiting Acceptance' : '✓ Accepted — Preparing',
        items: o.items || [],
        notes: o.notes,
        createdAt: o.createdAt,
        status: o.status,
        isTableKot: false,
      }))
      .sort(sortByOldest)
  }, [orders])

  const deliveryOrders = useMemo(() => {
    return orders
      .filter(o => ['placed', 'accepted'].includes(o.status) && o.orderType === 'delivery')
      .map(o => ({
        id: o.id,
        label: o.id.slice(-6).toUpperCase(),
        subLabel: `${o.customerName || 'Delivery'} ${o.status === 'placed' ? '· 🆕 New' : ''}`,
        items: o.items || [],
        notes: o.notes,
        createdAt: o.createdAt,
        status: o.status,
        isTableKot: false,
      }))
      .sort(sortByOldest)
  }, [orders])

  const historyOrders = useMemo(() => {
    const normal = orders
      .filter(o => ['ready', 'picked-up', 'delivered'].includes(o.status))
      .map(o => ({ id: o.id, displayId: o.id.slice(-6), orderType: o.orderType, status: o.status, items: o.items, createdAt: o.updatedAt || o.createdAt }))
    const table = tableKots
      .filter(k => k.status === 'ready' || k.status === 'served')
      .map(k => ({ id: k.id, displayId: k.kot_number, orderType: 'dine-in', status: k.status, items: k.items, createdAt: k.served_at || k.placed_at }))
    return [...normal, ...table].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20)
  }, [orders, tableKots])

  // ─── Sound on new orders ────────────────────────────────────────────────────
  const prevDineIn = useRef(dineInOrders.length)
  const prevTakeaway = useRef(takeawayOrders.length)
  const prevDelivery = useRef(deliveryOrders.length)

  useEffect(() => {
    if (dineInOrders.length > prevDineIn.current) {
      playOrderChime('dine-in')
      toast('🍽️ New Dine-In order!', { icon: '🔔', style: { background: '#EFF6FF', color: '#1d4ed8', fontWeight: 'bold' } })
    }
    prevDineIn.current = dineInOrders.length
  }, [dineInOrders.length])

  useEffect(() => {
    if (takeawayOrders.length > prevTakeaway.current) {
      playOrderChime('takeaway')
      toast('🥡 New Counter Takeaway!', { icon: '🔔', style: { background: '#FFFBEB', color: '#b45309', fontWeight: 'bold' } })
    }
    prevTakeaway.current = takeawayOrders.length
  }, [takeawayOrders.length])

  useEffect(() => {
    if (deliveryOrders.length > prevDelivery.current) {
      playOrderChime('delivery')
      toast('🛵 New Delivery order!', { icon: '🔔', style: { background: '#FFF5F5', color: '#CC0000', fontWeight: 'bold' } })
    }
    prevDelivery.current = deliveryOrders.length
  }, [deliveryOrders.length])

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleMarkTableKotReady = async (kotId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'placed' ? 'accepted' : 'ready'
    const { error } = await supabase.from('table_orders').update({ status: nextStatus }).eq('id', kotId)
    if (error) toast.error('Failed to update KOT')
    else toast.success(nextStatus === 'ready' ? 'KOT ready! 🍳' : 'KOT accepted 🧑‍🍳')
  }

  const handleMarkTableKotServed = async (kotId: string) => {
    const { error } = await supabase.from('table_orders')
      .update({ status: 'served', served_at: new Date().toISOString() })
      .eq('id', kotId)
    if (error) toast.error('Failed to mark served')
    else toast.success('Served at table ✓')
  }

  const handleMarkOrderReady = (orderId: string) => {
    updateOrderStatus(orderId, 'ready')
    toast.success('Order marked ready ✓')
  }

  // ─── Lock/Unlock ─────────────────────────────────────────────────────────────
  const handleLockSetup = (e: React.FormEvent) => {
    e.preventDefault()
    if (tempPin.length < 4) { toast.error('PIN must be at least 4 digits'); return }
    setKdsLockPin(tempPin)
    setIsLockingModalOpen(false)
    toast.success('KDS locked 🔒')
  }

  const handleUnlockVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (unlockInput === kdsLockPin) {
      setKdsLockPin(null); setUnlockInput(''); setTempPin('')
      setUnlockError(false); setIsUnlockingModalOpen(false)
      toast.success('KDS unlocked ✓')
    } else {
      setUnlockError(true); toast.error('Incorrect PIN')
    }
  }

  const bg = darkMode && bigTextMode ? 'bg-gray-900' : 'bg-[#F5F5F5]'
  const cardSectionBg = darkMode && bigTextMode
    ? 'bg-gray-900 border-gray-700'
    : 'bg-white border-brand-border'
  const textPrimary = darkMode && bigTextMode ? 'text-white' : 'text-brand-black'
  const textMuted2 = darkMode && bigTextMode ? 'text-gray-400' : 'text-brand-muted'

  const renderKdsBody = () => (
    <div className={`space-y-5 ${bigTextMode ? 'text-lg' : ''}`}>
      {/* Header Controls */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[16px] border shadow-sm ${cardSectionBg}`}>
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-[12px] ${darkMode && bigTextMode ? 'bg-gray-700' : 'bg-brand-redLight'}`}>
            <ChefHat size={24} className="text-brand-red" />
          </div>
          <div>
            <h1 className={`font-display font-bold text-[20px] tracking-tight flex items-center gap-2 ${textPrimary}`}>
              🍳 HFC Kitchen Display
              {kdsLockPin && <span className="text-[11px] bg-brand-black text-white px-2 py-0.5 rounded-full font-brand font-bold">🔒 Locked</span>}
            </h1>
            <p className={`font-body text-[12px] mt-0.5 ${textMuted2}`}>Real-time Kitchen Display System</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setBigTextMode(!bigTextMode)} className={`flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border transition-all ${bigTextMode ? 'bg-brand-black text-white border-brand-black' : 'bg-white text-brand-body border-brand-border hover:bg-brand-surface'}`}>
            {bigTextMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{bigTextMode ? 'Standard' : 'Wall Mode'}</span>
          </button>

          {bigTextMode && (
            <button onClick={() => setDarkMode(!darkMode)} className={`flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border transition-all ${darkMode ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-brand-body border-brand-border hover:bg-brand-surface'}`}>
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          )}

          <button onClick={() => playOrderChime('takeaway')} className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-border bg-white text-brand-body hover:bg-brand-surface transition-all">
            <BellRing size={15} />
            <span className="hidden md:inline">Test</span>
          </button>

          <a href="/admin/kitchen/closing" className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-border bg-white text-brand-body hover:bg-brand-surface transition-all">
            <ClipboardList size={15} className="text-brand-red" />
            <span>EOD Closing</span>
          </a>

          {kdsLockPin ? (
            <button onClick={() => setIsUnlockingModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-red bg-brand-redLight text-brand-red hover:bg-brand-red hover:text-white transition-all">
              <Unlock size={15} />
              <span>Unlock</span>
            </button>
          ) : (
            <button onClick={() => { setTempPin(''); setIsLockingModalOpen(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-border bg-white text-brand-body hover:bg-brand-surface transition-all">
              <Lock size={15} />
              <span className="hidden md:inline">Lock</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile Tab Switcher ─────────────────────────────────────────────── */}
      <div className="md:hidden flex gap-1 p-1 bg-white border border-brand-border rounded-[12px] shadow-sm">
        {([
          { key: 'dine-in', label: 'Dine-In', count: dineInOrders.length, color: 'text-blue-600' },
          { key: 'takeaway', label: 'Takeaway', count: takeawayOrders.length, color: 'text-amber-600' },
          { key: 'delivery', label: 'Delivery', count: deliveryOrders.length, color: 'text-brand-red' },
          { key: 'history', label: 'History', count: historyOrders.length, color: 'text-brand-muted' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 px-1 rounded-[8px] font-brand font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer ${activeTab === tab.key ? (tab.key === 'history' ? 'bg-brand-surface text-brand-black' : tab.key === 'dine-in' ? 'bg-blue-600 text-white' : tab.key === 'takeaway' ? 'bg-amber-500 text-white' : 'bg-brand-red text-white') : `${tab.color} hover:bg-brand-surface/50`}`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1 text-[9px]">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* ── Desktop 3-Column + History ──────────────────────────────────────── */}
      {/* History shown as last tab on mobile, or as bottom section on desktop */}

      {/* Desktop: 3 columns side-by-side */}
      <div className={`hidden md:grid grid-cols-3 gap-4`}>
        {/* DINE-IN Column */}
        <div className="flex flex-col rounded-[14px] overflow-hidden border border-blue-200 shadow-sm">
          <ColHeader
            icon={<UtensilsCrossed size={17} />}
            label="Dine-In"
            count={dineInOrders.length}
            bg="bg-blue-600"
          />
          <div className={`p-3 flex-1 overflow-y-auto max-h-[70vh] ${darkMode && bigTextMode ? 'bg-gray-900' : 'bg-blue-50/30'}`}>
            {dineInOrders.length === 0
              ? <EmptyColumn type="dine-in" darkMode={darkMode && bigTextMode} />
              : dineInOrders.map(o => (
                <KDSCard
                  key={o.id}
                  {...o}
                  orderType="dine-in"
                  bigText={bigTextMode}
                  darkMode={darkMode && bigTextMode}
                  onMarkReady={() => handleMarkTableKotReady(o.id, o.status)}
                  onMarkServed={() => handleMarkTableKotServed(o.id)}
                />
              ))
            }
          </div>
        </div>

        {/* TAKEAWAY Column */}
        <div className="flex flex-col rounded-[14px] overflow-hidden border border-amber-200 shadow-sm">
          <ColHeader
            icon={<ShoppingBag size={17} />}
            label="Takeaway"
            count={takeawayOrders.length}
            bg="bg-amber-500"
          />
          <div className={`p-3 flex-1 overflow-y-auto max-h-[70vh] ${darkMode && bigTextMode ? 'bg-gray-900' : 'bg-amber-50/30'}`}>
            {takeawayOrders.length === 0
              ? <EmptyColumn type="takeaway" darkMode={darkMode && bigTextMode} />
              : takeawayOrders.map(o => (
                <KDSCard
                  key={o.id}
                  {...o}
                  orderType="takeaway"
                  bigText={bigTextMode}
                  darkMode={darkMode && bigTextMode}
                  onMarkReady={() => handleMarkOrderReady(o.id)}
                />
              ))
            }
          </div>
        </div>

        {/* DELIVERY Column */}
        <div className="flex flex-col rounded-[14px] overflow-hidden border border-red-200 shadow-sm">
          <ColHeader
            icon={<Bike size={17} />}
            label="Delivery"
            count={deliveryOrders.length}
            bg="bg-brand-red"
          />
          <div className={`p-3 flex-1 overflow-y-auto max-h-[70vh] ${darkMode && bigTextMode ? 'bg-gray-900' : 'bg-red-50/30'}`}>
            {deliveryOrders.length === 0
              ? <EmptyColumn type="delivery" darkMode={darkMode && bigTextMode} />
              : deliveryOrders.map(o => (
                <KDSCard
                  key={o.id}
                  {...o}
                  orderType="delivery"
                  bigText={bigTextMode}
                  darkMode={darkMode && bigTextMode}
                  onMarkReady={() => handleMarkOrderReady(o.id)}
                />
              ))
            }
          </div>
        </div>
      </div>

      {/* Mobile: Single column based on active tab */}
      <div className="md:hidden">
        {activeTab === 'dine-in' && (
          <div className="rounded-[14px] overflow-hidden border border-blue-200 shadow-sm">
            <ColHeader icon={<UtensilsCrossed size={17} />} label="Dine-In" count={dineInOrders.length} bg="bg-blue-600" />
            <div className="p-3 bg-blue-50/30">
              {dineInOrders.length === 0 ? <EmptyColumn type="dine-in" darkMode={false} />
                : dineInOrders.map(o => <KDSCard key={o.id} {...o} orderType="dine-in" bigText={false} darkMode={false}
                    onMarkReady={() => handleMarkTableKotReady(o.id, o.status)}
                    onMarkServed={() => handleMarkTableKotServed(o.id)} />)}
            </div>
          </div>
        )}
        {activeTab === 'takeaway' && (
          <div className="rounded-[14px] overflow-hidden border border-amber-200 shadow-sm">
            <ColHeader icon={<ShoppingBag size={17} />} label="Takeaway" count={takeawayOrders.length} bg="bg-amber-500" />
            <div className="p-3 bg-amber-50/30">
              {takeawayOrders.length === 0 ? <EmptyColumn type="takeaway" darkMode={false} />
                : takeawayOrders.map(o => <KDSCard key={o.id} {...o} orderType="takeaway" bigText={false} darkMode={false}
                    onMarkReady={() => handleMarkOrderReady(o.id)} />)}
            </div>
          </div>
        )}
        {activeTab === 'delivery' && (
          <div className="rounded-[14px] overflow-hidden border border-red-200 shadow-sm">
            <ColHeader icon={<Bike size={17} />} label="Delivery" count={deliveryOrders.length} bg="bg-brand-red" />
            <div className="p-3 bg-red-50/30">
              {deliveryOrders.length === 0 ? <EmptyColumn type="delivery" darkMode={false} />
                : deliveryOrders.map(o => <KDSCard key={o.id} {...o} orderType="delivery" bigText={false} darkMode={false}
                    onMarkReady={() => handleMarkOrderReady(o.id)} />)}
            </div>
          </div>
        )}
      </div>

      {/* History Section (desktop: below columns; mobile: when tab = history) */}
      {(activeTab === 'history' || true) && (
        <div className={`${activeTab !== 'history' ? 'hidden md:block' : ''} bg-white border border-brand-border rounded-[16px] overflow-hidden shadow-sm`}>
          <div className="p-5 border-b border-brand-border bg-[#FDFDFD] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-brand-muted" />
              <h3 className="font-display font-bold text-[15px] text-brand-black">Recently Prepared</h3>
            </div>
            <span className="font-body text-[12px] text-brand-muted">Last 20 completed</span>
          </div>
          {historyOrders.length === 0 ? (
            <div className="p-10 text-center font-body text-[13px] text-brand-muted">
              <CheckCircle2 size={28} className="text-green-500 mx-auto mb-2" />
              No recently completed orders
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[520px]">
                <thead>
                  <tr className="bg-brand-surface font-brand font-bold text-[11px] text-brand-muted uppercase tracking-wider border-b border-brand-border">
                    <th className="p-4">Time</th>
                    <th className="p-4">Order</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Dishes</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {historyOrders.map(o => (
                    <tr key={o.id} className="hover:bg-brand-surface/30 transition-colors">
                      <td className="p-4 font-body text-[12.5px] text-brand-black">{formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}</td>
                      <td className="p-4 font-mono text-[12.5px] text-brand-muted">#{o.displayId}</td>
                      <td className="p-4 font-body text-[12px] text-brand-muted font-semibold uppercase">{o.orderType}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {o.items.map((it: any, i: number) => (
                            <span key={i} className="bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-[11px] font-semibold text-brand-black">
                              {it.quantity}x {it.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${o.status === 'delivered' || o.status === 'served' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          <CheckCircle2 size={10} />
                          {o.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {!kdsLockPin && renderKdsBody()}

      {kdsLockPin && (
        <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto p-5 md:p-8 animate-fade-in ${darkMode ? 'bg-gray-900' : 'bg-[#FAFAFA]'}`}>
          {renderKdsBody()}
        </div>
      )}

      {/* Lock Modal */}
      {isLockingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[14px] border border-brand-border shadow-xl w-full max-w-[400px] p-6">
            <h3 className="font-display font-bold text-[17px] text-brand-black">🔒 Set KDS Lock PIN</h3>
            <p className="font-body text-[12px] text-brand-muted mt-1.5">Enter 4+ digit PIN to lock the KDS screen and hide admin nav.</p>
            <form onSubmit={handleLockSetup} className="mt-4 space-y-4">
              <input type="password" pattern="[0-9]*" inputMode="numeric" maxLength={8} value={tempPin}
                onChange={e => setTempPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest font-mono text-[20px] font-bold p-3 border border-brand-border rounded-btn focus:outline-brand-red bg-brand-surface"
                placeholder="••••" required autoFocus />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsLockingModalOpen(false)} className="flex-1 py-2.5 border border-brand-border rounded-btn font-brand font-semibold text-[13px] text-brand-body hover:bg-brand-surface cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-black hover:bg-brand-red text-white rounded-btn font-brand font-bold text-[13px] cursor-pointer">Lock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {isUnlockingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[14px] border border-brand-border shadow-xl w-full max-w-[400px] p-6">
            <h3 className="font-display font-bold text-[17px] text-brand-black">🔓 Unlock KDS</h3>
            <p className="font-body text-[12px] text-brand-muted mt-1.5">Enter the session PIN to return to the admin dashboard.</p>
            <form onSubmit={handleUnlockVerify} className="mt-4 space-y-4">
              <input type="password" pattern="[0-9]*" inputMode="numeric" maxLength={8} value={unlockInput}
                onChange={e => { setUnlockInput(e.target.value.replace(/\D/g, '')); setUnlockError(false) }}
                className={`w-full text-center tracking-widest font-mono text-[20px] font-bold p-3 border rounded-btn focus:outline-brand-red bg-brand-surface ${unlockError ? 'border-red-400' : 'border-brand-border'}`}
                placeholder="••••" required autoFocus />
              {unlockError && <p className="text-[11px] text-brand-red font-semibold text-center flex items-center justify-center gap-1"><ShieldAlert size={12} /> Incorrect PIN</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setUnlockInput(''); setUnlockError(false); setIsUnlockingModalOpen(false) }} className="flex-1 py-2.5 border border-brand-border rounded-btn font-brand font-semibold text-[13px] text-brand-body hover:bg-brand-surface cursor-pointer">Keep Locked</button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-black hover:bg-brand-red text-white rounded-btn font-brand font-bold text-[13px] cursor-pointer">Unlock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
