'use client'

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Clock, Package, ShoppingBag } from 'lucide-react'

type OrderStatus = 'placed' | 'accepted' | 'ready' | 'delivered' | 'cancelled' | 'rejected'

interface CounterTokenTrackerProps {
  orderId: string
  tokenNumber: string
  items: { name: string; quantity: number; price: number }[]
  total: number
}

const STEPS: { key: OrderStatus | 'placed'; label: string; icon: React.ReactNode }[] = [
  { key: 'placed', label: 'Order Received', icon: <Package size={16} /> },
  { key: 'accepted', label: 'Preparing', icon: <Clock size={16} /> },
  { key: 'ready', label: 'Ready for Pickup', icon: <ShoppingBag size={16} /> },
  { key: 'delivered', label: 'Collected', icon: <CheckCircle2 size={16} /> },
]

const STATUS_ORDER: OrderStatus[] = ['placed', 'accepted', 'ready', 'delivered']

function playReadyChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6 — triumphant chord
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.7)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.7)
    })
  } catch (e) {
    console.warn('Audio not available:', e)
  }
}

export default function CounterTokenTracker({
  orderId,
  tokenNumber,
  items,
  total,
}: CounterTokenTrackerProps) {
  const [status, setStatus] = useState<OrderStatus>('placed')
  const [isReady, setIsReady] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)
  const prevStatusRef = useRef<OrderStatus>('placed')

  useEffect(() => {
    // Initial fetch
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .maybeSingle()
      if (data?.status) {
        setStatus(data.status as OrderStatus)
        if (data.status === 'ready' || data.status === 'delivered') {
          setIsReady(true)
        }
      }
    }
    fetchStatus()

    // Real-time subscription
    const channel = supabase
      .channel(`counter-order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const newStatus = payload.new.status as OrderStatus
          setStatus(newStatus)

          if (
            (newStatus === 'ready') &&
            prevStatusRef.current !== 'ready' &&
            prevStatusRef.current !== 'delivered'
          ) {
            // 🎉 ORDER READY — vibrate + chime + flash
            setIsReady(true)
            setFlashGreen(true)
            playReadyChime()
            try {
              navigator.vibrate?.([500, 200, 500, 200, 800])
            } catch {}
            setTimeout(() => setFlashGreen(false), 3000)
          }

          prevStatusRef.current = newStatus
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  const currentStepIndex = STATUS_ORDER.indexOf(status)

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-start pt-10 pb-24 px-4 transition-colors duration-700 ${
        flashGreen ? 'bg-green-50' : 'bg-[#FAFAFA]'
      }`}
    >
      {/* ORDER READY HERO */}
      {isReady && (
        <div className={`w-full max-w-sm mb-6 rounded-[20px] p-6 text-center border-2 animate-fade-in ${
          flashGreen
            ? 'bg-green-500 border-green-400 text-white shadow-xl shadow-green-200'
            : 'bg-green-50 border-green-300 text-green-800'
        }`}>
          <div className="text-[40px] mb-2">🎉</div>
          <h2 className={`font-display font-black text-[24px] ${flashGreen ? 'text-white' : 'text-green-800'}`}>
            YOUR ORDER IS READY!
          </h2>
          <p className={`font-body text-[14px] mt-1 ${flashGreen ? 'text-green-100' : 'text-green-700'}`}>
            Please collect at the counter
          </p>
          <p className={`font-body text-[12px] mt-2 ${flashGreen ? 'text-green-200' : 'text-green-600'}`}>
            Thank you! Visit us again 😊
          </p>
        </div>
      )}

      {/* Token Badge */}
      <div className="w-full max-w-sm bg-white border-2 border-brand-red rounded-[20px] p-6 text-center shadow-md shadow-brand-redLight/30 mb-6">
        <p className="font-brand font-semibold text-[11px] text-brand-muted uppercase tracking-[2px] mb-1">
          Your Token Number
        </p>
        <div className="font-mono font-black text-[52px] text-brand-red leading-none tracking-wider">
          # {tokenNumber}
        </div>
        <p className="font-body text-[12px] text-brand-muted mt-2">
          Show this number at the counter when called
        </p>
      </div>

      {/* Status Steps */}
      <div className="w-full max-w-sm bg-white border border-brand-border rounded-[16px] p-5 shadow-xs mb-5">
        <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-[1.5px] mb-4">
          Order Progress
        </p>
        <div className="space-y-3">
          {STEPS.map((step, idx) => {
            const done = idx <= currentStepIndex
            const active = idx === currentStepIndex
            return (
              <div key={step.key} className={`flex items-center gap-3 transition-all duration-300`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                  done
                    ? 'bg-brand-red border-brand-red text-white'
                    : 'bg-white border-brand-border text-brand-muted'
                } ${active && !isReady ? 'animate-pulse' : ''}`}>
                  {step.icon}
                </div>
                <span className={`font-brand font-semibold text-[13px] ${
                  done ? 'text-brand-black' : 'text-brand-muted'
                } ${active && !isReady ? 'font-bold' : ''}`}>
                  {step.label}
                  {active && !isReady && (
                    <span className="ml-2 text-[10px] text-brand-red font-bold uppercase tracking-wider">
                      ← Now
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Estimated Time */}
      {!isReady && (
        <div className="w-full max-w-sm bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-3 text-center mb-5">
          <p className="font-brand font-semibold text-[12px] text-amber-800">
            ⏱ Estimated: 10–15 minutes
          </p>
          <p className="font-body text-[11px] text-amber-700 mt-0.5">
            We'll show a green screen when your order is ready!
          </p>
        </div>
      )}

      {/* Items Ordered */}
      <div className="w-full max-w-sm bg-white border border-brand-border rounded-[16px] p-5 shadow-xs">
        <p className="font-brand font-bold text-[11px] text-brand-muted uppercase tracking-[1.5px] mb-3">
          Items Ordered
        </p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between items-center text-[13px]">
              <span className="font-body text-brand-black">
                {item.name} <span className="text-brand-muted">×{item.quantity}</span>
              </span>
              <span className="font-brand font-semibold text-brand-muted">
                ₹{(item.price * item.quantity).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-brand-border mt-3 pt-3 flex justify-between">
          <span className="font-brand font-bold text-[13px] text-brand-black">Total Paid</span>
          <span className="font-brand font-black text-[16px] text-brand-red">₹{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
