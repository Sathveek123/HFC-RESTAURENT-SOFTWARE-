'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWaiterStore, Waiter } from '@/store/waiterStore'
import { supabase } from '@/lib/supabase'
import { ShieldAlert, UserCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface WaiterStaff {
  id: string
  name: string
  is_active: boolean
}

export default function WaiterLoginPage() {
  const router = useRouter()
  const login = useWaiterStore(state => state.login)
  const isAuthenticated = useWaiterStore(state => state.isAuthenticated)

  const [waiters, setWaiters] = useState<WaiterStaff[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fetchingStaff, setFetchingStaff] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/waiter/panel')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    const fetchWaiters = async () => {
      try {
        const { data, error } = await supabase
          .from('waiters')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) throw error

        setWaiters(data || [])
        if (data && data.length > 0) {
          setSelectedId(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch waiters list:', err)
        setErrorMsg('Failed to load waiters list. Check connection.')
      } finally {
        setFetchingStaff(false)
      }
    }
    fetchWaiters()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !pin.trim()) {
      setErrorMsg('Please select your name and enter your PIN.')
      return
    }

    if (pin.trim().length !== 4) {
      setErrorMsg('PIN must be a 4-digit code.')
      return
    }

    setLoggingIn(true)
    setErrorMsg('')

    const res = await login(selectedId, pin.trim())
    if (res.success) {
      router.push('/waiter/panel')
    } else {
      setErrorMsg(res.error || 'Incorrect PIN code.')
      setPin('')
      setLoggingIn(false)
    }
  }

  const handlePinClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num)
      setErrorMsg('')
    }
  }

  const handleClear = () => {
    setPin('')
    setErrorMsg('')
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white border border-brand-border rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-6 space-y-6">
        
        {/* Logo Badge */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-[52px] h-[52px] rounded-full bg-brand-red flex items-center justify-center text-white font-brand font-black text-[20px] shadow-sm mb-3">
            HFC
          </div>
          <h1 className="font-display font-bold text-[22px] text-brand-black">Waiter Portal</h1>
          <p className="font-body text-[12px] text-brand-muted mt-0.5">
            Dine-In Order acceptance & approval stand
          </p>
        </div>

        {fetchingStaff ? (
          <div className="flex flex-col items-center py-10 justify-center text-brand-muted space-y-2">
            <Loader2 className="animate-spin text-brand-red" size={24} />
            <p className="font-body text-[12px]">Loading waiters list...</p>
          </div>
        ) : waiters.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-[10px] p-4 text-center">
            <ShieldAlert className="text-brand-red mx-auto mb-2" size={24} />
            <p className="font-body text-[12.5px] text-red-800 leading-relaxed">
              No active waiters found in the database. Please add waiter profiles in the Admin Panel before logging in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[8px] text-red-600 font-body text-[12px] text-left">
                <ShieldAlert size={14} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block font-brand font-semibold text-[11px] text-brand-muted uppercase tracking-[0.5px] mb-1.5 text-left">
                Select Your Name
              </label>
              <select
                value={selectedId}
                onChange={e => {
                  setSelectedId(e.target.value)
                  setErrorMsg('')
                  setPin('')
                }}
                className="w-full h-[46px] border border-brand-border rounded-[8px] px-4 font-body text-[14px] text-brand-black focus:border-brand-red focus:outline-none transition-all bg-white"
              >
                {waiters.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-brand font-semibold text-[11px] text-brand-muted uppercase tracking-[0.5px] mb-2.5 text-left">
                4-Digit PIN Code
              </label>
              
              {/* Dot Indicators */}
              <div className="flex justify-center gap-4 mb-4">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 border-brand-border transition-all ${
                      pin.length > i ? 'bg-brand-red border-brand-red scale-110' : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Pin Pad Grid */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinClick(num)}
                    className="h-12 bg-[#FAFAFA] hover:bg-gray-100 text-brand-black font-brand font-bold text-[18px] rounded-[8px] border border-brand-border active:scale-95 transition-all cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-12 bg-gray-50 hover:bg-gray-100 text-brand-muted font-brand font-bold text-[12px] rounded-[8px] border border-brand-border active:scale-95 transition-all cursor-pointer uppercase"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handlePinClick('0')}
                  className="h-12 bg-[#FAFAFA] hover:bg-gray-100 text-brand-black font-brand font-bold text-[18px] rounded-[8px] border border-brand-border active:scale-95 transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="submit"
                  disabled={loggingIn || pin.length !== 4}
                  className="h-12 bg-brand-red text-white hover:bg-brand-redHover font-brand font-bold text-[12px] uppercase rounded-[8px] active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  {loggingIn ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <UserCheck size={14} /> Enter
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
