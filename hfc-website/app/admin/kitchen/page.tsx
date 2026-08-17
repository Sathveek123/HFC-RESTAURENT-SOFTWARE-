'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ChefHat, Clock, Utensils, CheckCircle2, History,
  Maximize2, Minimize2, BellRing, Sparkles, MessageSquare,
  Lock, Unlock, ShieldAlert, ClipboardList
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useOrderStore, OrderRecord } from '@/store/orderStore'

export default function KitchenViewPage() {
  const orders = useOrderStore(state => state.orders)
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus)

  const [activeTab, setActiveTab] = useState<'cooking' | 'history'>('cooking')
  const [bigTextMode, setBigTextMode] = useState(false)
  const [timeTicker, setTimeTicker] = useState(0)

  // KDS Screen Lock States
  const [kdsLockPin, setKdsLockPin] = useState<string | null>(null)
  const [isLockingModalOpen, setIsLockingModalOpen] = useState(false)
  const [isUnlockingModalOpen, setIsUnlockingModalOpen] = useState(false)
  const [tempPin, setTempPin] = useState('')
  const [unlockInput, setUnlockInput] = useState('')
  const [unlockError, setUnlockError] = useState(false)

  // 1. Dynamic elapsed time ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTicker(prev => prev + 1)
    }, 15000) // update every 15s
    return () => clearInterval(interval)
  }, [])

  // Filter orders
  const cookingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'accepted')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [orders])

  const historyOrders = useMemo(() => {
    return orders.filter(o => o.status === 'ready' || o.status === 'picked-up' || o.status === 'delivered')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 16) // Show last 16 completed
  }, [orders])

  // 2. Play kitchen bell sound when a new order arrives in accepted status
  const prevCountRef = useRef(cookingOrders.length)
  useEffect(() => {
    if (cookingOrders.length > prevCountRef.current) {
      playKitchenSound()
      toast('🍳 New cooking order in kitchen!', {
        icon: '🔔',
        style: {
          borderRadius: '10px',
          background: '#FFF5F5',
          color: '#E53E3E',
          fontWeight: 'bold',
        }
      })
    }
    prevCountRef.current = cookingOrders.length
  }, [cookingOrders.length])

  const playKitchenSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()

      // High-Fidelity soft kitchen bell ding (E6 / 1318.51Hz)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.8)
    } catch (e) {
      console.warn('Audio Context blocked or not supported:', e)
    }
  }

  // Handle Order Status advance to ready
  const handleMarkReady = (orderId: string) => {
    updateOrderStatus(orderId, 'ready')
    toast.success('Food marked ready & packed ✓')
  }

  // Elapsed time styling helper
  const getElapsedStyles = (createdAtStr: string) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(createdAtStr).getTime()) / 60000)
    if (elapsedMinutes >= 20) {
      return {
        bg: 'bg-red-50 text-red-700 border-red-200 animate-pulse',
        badge: 'bg-red-600 text-white animate-ping',
        text: 'text-red-600',
        card: 'border-red-400 shadow-md shadow-red-50/50'
      }
    }
    if (elapsedMinutes >= 10) {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'bg-amber-500 text-white',
        text: 'text-amber-600',
        card: 'border-amber-300'
      }
    }
    return {
      bg: 'bg-green-50 text-green-700 border-green-200',
      badge: 'bg-green-600 text-white',
      text: 'text-green-600',
      card: 'border-brand-border'
    }
  }

  // Lock KDS view handler
  const handleLockSetup = (e: React.FormEvent) => {
    e.preventDefault()
    if (tempPin.length < 4) {
      toast.error('PIN must be at least 4 digits')
      return
    }
    setKdsLockPin(tempPin)
    setIsLockingModalOpen(false)
    toast.success('KDS Monitor view locked securely 🔒')
  }

  // Unlock KDS view handler
  const handleUnlockVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (unlockInput === kdsLockPin) {
      setKdsLockPin(null)
      setUnlockInput('')
      setTempPin('')
      setUnlockError(false)
      setIsUnlockingModalOpen(false)
      toast.success('KDS Monitor unlocked successfully ✓')
    } else {
      setUnlockError(true)
      toast.error('Incorrect unlock PIN')
    }
  }

  // Render KDS Contents (Abstracted so it can render both normal and fullscreen overlay modes)
  const renderKdsBody = () => (
    <div className="space-y-6">
      {/* Upper Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-[16px] border border-brand-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-redLight rounded-[12px] text-brand-red">
            <ChefHat size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[22px] text-brand-black tracking-tight flex items-center gap-2">
              Kitchen View Monitor
              {kdsLockPin && <span className="text-[12px] bg-brand-black text-white px-2 py-0.5 rounded-full font-brand font-bold flex items-center gap-1">🔒 Locked</span>}
            </h1>
            <p className="font-body text-[12.5px] text-brand-muted mt-0.5">Real-time Kitchen Display System (KDS)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Big Text Toggle */}
          <button
            onClick={() => setBigTextMode(!bigTextMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border transition-all ${
              bigTextMode
                ? 'bg-brand-black text-white border-brand-black shadow-sm'
                : 'bg-white text-brand-body border-brand-border hover:bg-brand-surface'
            }`}
          >
            {bigTextMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{bigTextMode ? 'Standard Text' : 'Wall-Mount mode'}</span>
          </button>

          {/* Test Sound */}
          <button
            onClick={playKitchenSound}
            className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-border bg-white text-brand-body hover:bg-brand-surface transition-all"
            title="Test alert chime"
          >
            <BellRing size={16} />
            <span className="hidden md:inline">Test Alert</span>
          </button>

          {/* EOD Closing Stock */}
          <a
            href="/admin/kitchen/closing"
            className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-border bg-white text-brand-body hover:bg-brand-surface transition-all"
            title="Submit daily closing counts"
          >
            <ClipboardList size={16} className="text-brand-red" />
            <span>EOD Closing Stock</span>
          </a>

          {/* Lock Screen Button */}
          {kdsLockPin ? (
            <button
              onClick={() => setIsUnlockingModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-red bg-brand-redLight text-brand-red hover:bg-brand-red hover:text-white transition-all shadow-sm"
            >
              <Unlock size={16} />
              <span>Unlock Monitor</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setTempPin('')
                setIsLockingModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-btn text-[13px] font-brand font-semibold cursor-pointer border border-brand-border bg-white text-brand-body hover:bg-brand-surface transition-all"
              title="Hide sidebar & lock screen with temporary PIN"
            >
              <Lock size={16} />
              <span className="hidden md:inline">Lock Screen</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-brand-border gap-4">
        <button
          onClick={() => setActiveTab('cooking')}
          className={`flex items-center gap-2 pb-3 px-1 text-[14.5px] font-brand font-semibold relative cursor-pointer transition-all ${
            activeTab === 'cooking' ? 'text-brand-red border-b-[2.5px] border-brand-red' : 'text-brand-muted hover:text-brand-black'
          }`}
        >
          <Utensils size={17} />
          <span>Active Cooking</span>
          {cookingOrders.length > 0 && (
            <span className="bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {cookingOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 pb-3 px-1 text-[14.5px] font-brand font-semibold relative cursor-pointer transition-all ${
            activeTab === 'history' ? 'text-brand-red border-b-[2.5px] border-brand-red' : 'text-brand-muted hover:text-brand-black'
          }`}
        >
          <History size={17} />
          <span>Recently Prepared</span>
        </button>
      </div>

      {/* Cooking View Tab */}
      {activeTab === 'cooking' && (
        <>
          {cookingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white border border-brand-border rounded-[20px] p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="font-display font-bold text-[17px] text-brand-black">All Caught Up!</h3>
              <p className="font-body text-[13px] text-brand-muted max-w-[320px] mt-1">
                No orders need preparing right now. New accepted orders will chime here instantly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {cookingOrders.map(order => {
                const elapsedStyles = getElapsedStyles(order.createdAt)
                const relativeTime = formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })

                return (
                  <div
                    key={order.id}
                    className={`flex flex-col bg-white border rounded-[16px] overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${elapsedStyles.card}`}
                  >
                    {/* Header: Order ID & Time Status */}
                    <div className="p-4 border-b border-brand-border bg-[#FDFDFD]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[15px] text-brand-black">
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${elapsedStyles.bg}`}>
                          <Clock size={12} />
                          <span>{relativeTime}</span>
                        </div>
                      </div>

                      {/* Display order type */}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[11px] font-brand font-bold text-brand-muted uppercase tracking-wider">
                          Type: {order.orderType.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Items List - Rendered Large if BigTextMode is on */}
                    <div className="p-5 flex-1 space-y-4">
                      <div className="space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2">
                              <span className={`font-brand font-black ${bigTextMode ? 'text-[24px]' : 'text-[17px]'} text-brand-black`}>
                                {item.quantity}x
                              </span>
                              <div className="flex flex-col">
                                <span className={`font-brand font-bold ${bigTextMode ? 'text-[18px] leading-snug' : 'text-[14px]'} text-brand-black`}>
                                  {item.name}
                                </span>
                              </div>
                            </div>
                            <span className="w-2.5 h-2.5 rounded-full bg-brand-border mt-2 flex-shrink-0" />
                          </div>
                        ))}
                      </div>

                      {/* Special Chef Instructions (notes) */}
                      {order.notes && (
                        <div className="mt-4 p-3 bg-brand-surface rounded-[10px] border border-brand-border flex items-start gap-2">
                          <MessageSquare size={14} className="text-brand-red flex-shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-brand font-bold text-brand-red uppercase tracking-wider">Instructions:</span>
                            <p className="text-[11.5px] font-body font-semibold text-brand-black mt-0.5">
                              {order.notes}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mark Ready Button */}
                    <div className="p-4 border-t border-brand-border bg-[#FDFDFD]">
                      <button
                        onClick={() => handleMarkReady(order.id)}
                        className="w-full py-3.5 rounded-btn flex items-center justify-center gap-2 cursor-pointer transition-all bg-brand-black hover:bg-brand-red text-white hover:shadow-lg font-bold font-brand text-[13.5px]"
                      >
                        <CheckCircle2 size={16} />
                        <span>Food Ready & Packed</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* History View Tab */}
      {activeTab === 'history' && (
        <div className="bg-white border border-brand-border rounded-[20px] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-brand-border bg-[#FDFDFD] flex items-center justify-between">
            <h3 className="font-display font-bold text-[16px] text-brand-black">Recently Prepared Items</h3>
            <span className="font-body text-[12px] text-brand-muted">Showing last 16 completed chef plates</span>
          </div>

          {historyOrders.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-body text-[13px] text-brand-muted">No recently completed orders found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-surface font-brand font-bold text-[11px] text-brand-muted uppercase tracking-wider border-b border-brand-border">
                    <th className="p-4">Time</th>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Dishes</th>
                    <th className="p-4">Finished Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {historyOrders.map(order => {
                    const relativeTime = formatDistanceToNow(new Date(order.updatedAt || order.createdAt), { addSuffix: true })
                    return (
                      <tr key={order.id} className="hover:bg-brand-surface/30 transition-colors">
                        <td className="p-4 font-body text-[12.5px] text-brand-black font-medium">
                          {relativeTime}
                        </td>
                        <td className="p-4 font-mono text-[12.5px] text-brand-muted">
                          #{order.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="p-4 font-body text-[12px] text-brand-muted font-semibold uppercase">
                          {order.orderType}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {order.items.map((it, i) => (
                              <span key={i} className="inline-flex items-center bg-brand-surface border border-brand-border px-2 py-0.5 rounded-[6px] text-[11.5px] font-semibold text-brand-black">
                                {it.quantity}x {it.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            order.status === 'delivered'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            <CheckCircle2 size={11} />
                            <span>{order.status === 'delivered' ? 'Delivered' : order.status.toUpperCase()}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
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
      {/* 1. Normal View (Inherits Admin sidebar and topbar) */}
      {!kdsLockPin && renderKdsBody()}

      {/* 2. Secure Locked Fullscreen Overlay View */}
      {/* Uses absolute/fixed layout with high z-index to overlay and block sidebar/topbar completely */}
      {kdsLockPin && (
        <div className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col overflow-y-auto p-6 md:p-8 animate-fade-in">
          {renderKdsBody()}
        </div>
      )}

      {/* 3. Locking setup Modal */}
      {isLockingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[14px] border border-brand-border shadow-xl w-full max-w-[420px] p-6">
            <h3 className="font-display font-bold text-[17px] text-brand-black flex items-center gap-2">
              🔒 Set Screen Lock PIN
            </h3>
            <p className="font-body text-[12px] text-brand-muted mt-1.5">
              Enter a temporary 4-digit PIN to lock this KDS screen. This hides the admin navigation menu to prevent unauthorized access.
            </p>
            <form onSubmit={handleLockSetup} className="mt-4 space-y-4">
              <input
                type="password"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={8}
                value={tempPin}
                onChange={e => setTempPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest font-mono text-[20px] font-bold p-3 border border-brand-border rounded-btn focus:outline-brand-red bg-brand-surface"
                placeholder="••••"
                required
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLockingModalOpen(false)}
                  className="flex-1 py-2.5 border border-brand-border rounded-btn font-brand font-semibold text-[13px] text-brand-body hover:bg-brand-surface cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-black hover:bg-brand-red text-white rounded-btn font-brand font-bold text-[13px] cursor-pointer text-center"
                >
                  Lock Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Unlocking verification Modal */}
      {isUnlockingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[14px] border border-brand-border shadow-xl w-full max-w-[420px] p-6">
            <h3 className="font-display font-bold text-[17px] text-brand-black flex items-center gap-2">
              🔓 Enter KDS Unlock PIN
            </h3>
            <p className="font-body text-[12px] text-brand-muted mt-1.5">
              Type the temporary session PIN to return to the admin dashboard.
            </p>
            <form onSubmit={handleUnlockVerify} className="mt-4 space-y-4">
              <input
                type="password"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={8}
                value={unlockInput}
                onChange={e => {
                  setUnlockInput(e.target.value.replace(/\D/g, ''))
                  setUnlockError(false)
                }}
                className={`w-full text-center tracking-widest font-mono text-[20px] font-bold p-3 border rounded-btn focus:outline-brand-red bg-brand-surface ${
                  unlockError ? 'border-red-400 focus:outline-red-500' : 'border-brand-border'
                }`}
                placeholder="••••"
                required
                autoFocus
              />
              {unlockError && (
                <p className="text-[11px] text-brand-red font-semibold text-center flex items-center justify-center gap-1">
                  <ShieldAlert size={12} /> Incorrect PIN. Please try again.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockInput('')
                    setUnlockError(false)
                    setIsUnlockingModalOpen(false)
                  }}
                  className="flex-1 py-2.5 border border-brand-border rounded-btn font-brand font-semibold text-[13px] text-brand-body hover:bg-brand-surface cursor-pointer text-center"
                >
                  Keep Locked
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-black hover:bg-brand-red text-white rounded-btn font-brand font-bold text-[13px] cursor-pointer text-center"
                >
                  Unlock Monitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
