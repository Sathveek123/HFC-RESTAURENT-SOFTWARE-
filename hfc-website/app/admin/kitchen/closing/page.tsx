'use client'

import React, { useEffect, useState } from 'react'
import { useInventoryStore, Ingredient, StockEntry, KitchenClosing } from '@/store/inventoryStore'
import { useRecipeStore } from '@/store/recipeStore'
import { useOrderStore } from '@/store/orderStore'
import { useSettingsStore } from '@/store/settingsStore'
import { calculateTheoreticalConsumption } from '@/lib/inventoryHelpers'
import { ClipboardList, Save, ShieldAlert, CheckCircle, Loader2, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface ClosingRow {
  ingredientId: string
  actualRemaining: number
  wastageQty: number
  wastageReason: string
}

interface StaffMember {
  id: string
  name: string
  is_active: boolean
}

export default function KitchenClosingPage() {
  const fetchIngredients = useInventoryStore(state => state.fetchIngredients)
  const ingredients = useInventoryStore(state => state.ingredients)
  
  const fetchStockEntries = useInventoryStore(state => state.fetchStockEntriesForDate)
  const fetchKitchenClosing = useInventoryStore(state => state.fetchKitchenClosingForDate)
  const submitClosing = useInventoryStore(state => state.submitKitchenClosing)
  const isInventoryLoading = useInventoryStore(state => state.isLoading)

  const fetchRecipes = useRecipeStore(state => state.fetchRecipes)
  const recipes = useRecipeStore(state => state.recipes)

  const orders = useOrderStore(state => state.orders)
  
  // Settings configurations for dynamic closing hours
  const fetchAndSyncSettings = useSettingsStore(state => state.fetchAndSyncSettings)
  const settings = useSettingsStore(state => state.settings)

  const [todayStr] = useState(() => new Date().toISOString().split('T')[0])
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([])
  const [existingClosing, setExistingClosing] = useState<KitchenClosing[]>([])
  const [isLoadingPrev, setIsLoadingPrev] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // Secure Staff PIN states
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [verifiedStaffName, setVerifiedStaffName] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  // Countdown clock & locked windows (Configurable close hour, default 10 PM)
  const [timeUntilOpen, setTimeUntilOpen] = useState('')
  const [isOpenWindow, setIsOpenWindow] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [bypassLockout, setBypassLockout] = useState(false)

  // Inputs
  const [rows, setRows] = useState<ClosingRow[]>([])

  useEffect(() => {
    fetchAndSyncSettings()
  }, [fetchAndSyncSettings])

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.user_metadata?.role === 'admin') {
          setIsAdmin(true)
        }
      } catch (e) {}
    }
    checkAdmin()
  }, [])

  useEffect(() => {
    const closeHour = settings?.kitchenCloseHour ?? 22
    const openHour = settings?.kitchenOpenHour ?? 4

    const updateCountdown = () => {
      const now = new Date()
      const currentHour = now.getHours()
      
      // Kitchen closing is open between closeHour (e.g. 22) and openHour (e.g. 4)
      const isWindow = currentHour >= closeHour || currentHour < openHour
      setIsOpenWindow(isWindow)

      if (!isWindow) {
        const target = new Date()
        target.setHours(closeHour, 0, 0, 0)
        if (now > target) {
          target.setDate(target.getDate() + 1)
        }
        
        const diffMs = target.getTime() - now.getTime()
        const hrs = Math.floor(diffMs / (1000 * 60 * 60))
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        const secs = Math.floor((diffMs % (1000 * 60)) / 1000)
        
        const pad = (num: number) => String(num).padStart(2, '0')
        setTimeUntilOpen(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`)
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [settings?.kitchenCloseHour, settings?.kitchenOpenHour])

  const loadData = React.useCallback(async () => {
    setIsLoadingPrev(true)
    await fetchIngredients()
    await fetchRecipes()

    const stk = await fetchStockEntries(todayStr)
    setStockEntries(stk)

    const cls = await fetchKitchenClosing(todayStr)
    setExistingClosing(cls)

    // Load active staff members
    try {
      const { data, error } = await supabase
        .from('kitchen_staff')
        .select('id, name, is_active')
        .eq('is_active', true)
      if (data) {
        setStaffList(data)
        if (data.length > 0) {
          setSelectedStaffId(data[0].id)
        }
      }
    } catch (e) {
      console.warn('Failed to load kitchen staff list:', e)
    }

    if (cls.length > 0) {
      setIsLocked(true)
    }
    setIsLoadingPrev(false)
  }, [todayStr, fetchIngredients, fetchRecipes, fetchStockEntries, fetchKitchenClosing])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Initialize rows dynamically once ingredients are fetched and synced
  useEffect(() => {
    if (ingredients.length > 0 && !isLocked && rows.length === 0) {
      setRows(ingredients.map(ing => ({
        ingredientId: ing.id,
        actualRemaining: 0,
        wastageQty: 0,
        wastageReason: 'Expired'
      })))
    }
  }, [ingredients, isLocked, rows.length])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaffId || !pin.trim()) {
      toast.error('Please select name and enter PIN')
      return
    }

    setIsVerifying(true)
    try {
      // Execute secure server-side RPC PIN verification
      const { data, error } = await supabase.rpc('verify_staff_pin', {
        p_staff_id: selectedStaffId,
        p_pin: pin.trim()
      })

      if (error) throw error

      if (data === true) {
        const staff = staffList.find(s => s.id === selectedStaffId)
        setVerifiedStaffName(staff ? staff.name : 'Kitchen Staff')
        setIsAuthorized(true)
        toast.success('Access authorized securely ✓')
      } else {
        toast.error('Incorrect PIN credentials!')
      }
    } catch (err: any) {
      console.error('RPC pin verification failed:', err)
      toast.error(`Verification error: ${err.message || err}`)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleValueChange = (index: number, field: keyof ClosingRow, value: any) => {
    const updated = [...rows]
    updated[index] = {
      ...updated[index],
      [field]: value
    }
    setRows(updated)
  }

  const handleSubmitClosing = async () => {
    // 1. Calculate today's theoretical consumption (idempotently excluding rejected/cancelled)
    const todayOrders = orders.filter(
      o => o.createdAt?.startsWith(todayStr) && o.status !== 'rejected' && o.status !== 'cancelled'
    )
    const theoreticalConsumptionMap = calculateTheoreticalConsumption(todayOrders, recipes)

    // Build payload rows
    const closingPayload = rows.map(row => {
      const ing = ingredients.find(i => i.id === row.ingredientId)
      const stk = stockEntries.find(s => s.ingredientId === row.ingredientId)
      
      const totalAvailable = stk ? stk.totalAvailable : 0
      const costPerUnit = ing ? ing.costPerUnit : 0
      const theoreticalConsumed = theoreticalConsumptionMap.get(row.ingredientId) || 0

      // actualConsumed = totalAvailable - actualRemaining
      const actualConsumed = Math.max(0, totalAvailable - row.actualRemaining)

      // discrepancy = actualConsumed - expectedConsumed (theoretical + wastage)
      const expectedConsumed = theoreticalConsumed + row.wastageQty
      const discrepancy = actualConsumed - expectedConsumed
      const discrepancyValue = discrepancy * costPerUnit

      return {
        ingredientId: row.ingredientId,
        theoreticalConsumed,
        actualRemaining: row.actualRemaining,
        actualConsumed,
        wastageReported: row.wastageQty,
        wastageReason: row.wastageQty > 0 ? row.wastageReason : undefined,
        discrepancy,
        discrepancyValue
      }
    })

    const ok = await submitClosing(todayStr, closingPayload, verifiedStaffName)
    if (ok) {
      toast.success('Kitchen closing counts submitted successfully!')
      setIsLocked(true)

      // Trigger automatic WhatsApp notification to the owner if discrepancy is critical
      // Critical = variance > 8% of total available OR shrinkage value > ₹500
      const criticalItems = closingPayload.filter(c => {
        const rate = ingredients.find(i => i.id === c.ingredientId)?.costPerUnit || 0
        const absVal = Math.abs(c.discrepancyValue)
        const stk = stockEntries.find(s => s.ingredientId === c.ingredientId)
        const available = stk ? stk.totalAvailable : 0
        const percent = available > 0 ? (Math.abs(c.discrepancy) / available) * 100 : 0
        return percent > 8 || absVal > 500
      })

      if (criticalItems.length > 0) {
        const ownerPhone = '919912799855'
        let alertText = `⚠️ *HFC Inventory Discrepancy Alert!*\n\n`
        alertText += `Critical variances detected in EOD counts submitted by *${verifiedStaffName}* today:\n`
        criticalItems.forEach(c => {
          const name = ingredients.find(i => i.id === c.ingredientId)?.name || c.ingredientId
          alertText += `- *${name}*: Variance of ${c.discrepancy.toFixed(2)} (Value: -₹${Math.abs(c.discrepancyValue).toFixed(0)})\n`
        })
        alertText += `\nPlease check reports dashboard: https://hfc-website-two.vercel.app/admin/inventory/reports`
        
        window.open(`https://wa.me/${ownerPhone}?text=${encodeURIComponent(alertText)}`, '_blank')
      }

      loadData()
    } else {
      toast.error('Failed to submit kitchen closing counts')
    }
  }

  // 1. Countdown operational lockout gate (Opens strictly at 10 PM / 22:00)
  if (!isOpenWindow && !isAdmin && !bypassLockout) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center p-4">
        <div className="bg-white border border-brand-border rounded-card max-w-sm w-full p-6 shadow-card space-y-6 text-center">
          <div className="w-16 h-16 bg-red-50 text-brand-red rounded-full flex items-center justify-center mx-auto animate-pulse">
            <ShieldAlert size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="font-brand font-black text-[22px] text-brand-black">Kitchen is Open</h2>
            <p className="font-body text-[13px] text-brand-body leading-relaxed">
              EOD Kitchen Closing submissions are locked during regular daily operations to prevent premature entry.
            </p>
          </div>

          <div className="bg-brand-surface border border-brand-border p-4 rounded-btn">
            <p className="font-body text-[11px] text-brand-muted uppercase tracking-wider font-semibold">Opening Countdown</p>
            <p className="font-mono font-black text-[32px] text-brand-black mt-1 tracking-wider">
              {timeUntilOpen || `${(settings?.kitchenCloseHour ?? 22) % 12 || 12}:00 ${(settings?.kitchenCloseHour ?? 22) >= 12 ? 'PM' : 'AM'}`}
            </p>
            <p className="font-body text-[11px] text-brand-muted mt-1.5">
              Closing sheet unlocks daily at {(settings?.kitchenCloseHour ?? 22) % 12 || 12}:00 {(settings?.kitchenCloseHour ?? 22) >= 12 ? 'PM' : 'AM'}
            </p>
          </div>

          <p className="font-body text-[11px] text-brand-muted">
            Standard operating window: {(settings?.kitchenCloseHour ?? 22) % 12 || 12}:00 {(settings?.kitchenCloseHour ?? 22) >= 12 ? 'PM' : 'AM'} - {(settings?.kitchenOpenHour ?? 4) % 12 || 12}:00 {(settings?.kitchenOpenHour ?? 4) >= 12 ? 'PM' : 'AM'}
          </p>
        </div>
      </div>
    )
  }

  // 2. Verified PIN Auth Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center p-4">
        <div className="bg-white border border-brand-border rounded-card max-w-sm w-full p-6 shadow-card space-y-4 text-center">
          <ShieldAlert className="mx-auto text-brand-red" size={36} />
          <div>
            <h2 className="font-brand font-black text-[20px] text-brand-black">Kitchen Staff Auth</h2>
            <p className="font-body text-[12px] text-brand-muted mt-0.5">
              Select your name and enter your 4-digit PIN to open the closing count sheets.
            </p>
          </div>

          {/* Admin bypass banner notification */}
          {!isOpenWindow && (isAdmin || bypassLockout) && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-[11px] p-2.5 rounded-btn font-body text-left">
              🔓 <strong>Admin Override Active:</strong> Viewing page outside standard hours.
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-brand font-semibold text-brand-muted text-left mb-1">Staff Member</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full h-11 px-3 bg-brand-surface border border-brand-border rounded-btn font-body text-[13px] outline-none"
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-brand font-semibold text-brand-muted text-left mb-1">PIN Code</label>
              <input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full h-11 text-center font-mono font-bold text-[18px] border border-brand-border bg-brand-surface rounded-btn focus:border-brand-red outline-none tracking-widest"
                maxLength={4}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || staffList.length === 0}
              className="w-full h-11 bg-brand-black disabled:opacity-50 text-white hover:bg-brand-red font-brand font-semibold text-[13px] uppercase rounded-btn transition-colors flex items-center justify-center gap-1.5"
            >
              {isVerifying ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}
              Verify PIN
            </button>
          </form>

          {/* Provide owners access to bypass standard window locally */}
          {isAdmin && !bypassLockout && (
            <button
              onClick={() => setBypassLockout(true)}
              className="font-brand font-bold text-[11px] text-brand-red hover:underline pt-2 uppercase"
            >
              Bypass Lockout Window (Admin Only)
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-5">
        <div>
          <h1 className="font-brand font-black text-[28px] text-brand-black leading-tight flex items-center gap-2">
            <ClipboardList className="text-brand-red" size={28} />
            Kitchen Closing Stock Count
          </h1>
          <p className="font-body text-[13px] text-brand-body mt-1">
            Logged in as <strong className="text-brand-red font-bold">{verifiedStaffName}</strong> | Submit physical counts.
          </p>
        </div>
      </div>

      {isLoadingPrev ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-muted space-y-2">
          <Loader2 className="animate-spin text-brand-red" size={32} />
          <p className="font-body text-[13px]">Loading closing records...</p>
        </div>
      ) : isLocked ? (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-card p-6 flex items-center gap-4 text-green-900 shadow-xs">
            <CheckCircle size={32} className="text-green-600 flex-shrink-0" />
            <div>
              <h3 className="font-brand font-bold text-[16px]">Closing Counts Recorded</h3>
              <p className="font-body text-[13px] mt-0.5 text-green-800">
                Today&apos;s physical remaining quantities have been recorded. Discrepancies have been logged for administrative audit.
              </p>
            </div>
          </div>

          {/* Submitted data list - STRICT ZERO VARIANCE FEEDBACK LOOP: Hidden discrepancy columns */}
          <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs">
            <h2 className="font-brand font-bold text-[15px] text-brand-black mb-4">
              Your Recorded Counts
            </h2>
            <div className="space-y-3">
              {existingClosing.map(cls => {
                const ing = ingredients.find(i => i.id === cls.ingredientId)
                return (
                  <div key={cls.id} className="flex justify-between items-center border-b border-brand-border pb-2.5 text-[13px] font-body">
                    <div>
                      <p className="font-semibold text-brand-black">{ing?.name}</p>
                    </div>
                    <span className="font-mono text-brand-body font-semibold">
                      Counted: {cls.actualRemaining} {ing?.unit}
                      {cls.wastageReported > 0 && ` (Wastage: ${cls.wastageReported} ${ing?.unit})`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : stockEntries.length === 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-card p-6 text-brand-red flex items-center gap-3">
          <ShieldAlert className="flex-shrink-0" size={24} />
          <p className="font-body text-[13px]">
            <strong>Opening Stock Not Entered:</strong> The admin/owner has not confirmed today&apos;s opening stock yet. Please request the admin to log opening stock before submitting kitchen closing counts.
          </p>
        </div>
      ) : (
        /* Closing Inputs */
        <div className="space-y-6">
          <div className="bg-brand-surface border border-brand-border rounded-card p-4 text-[12px] text-brand-muted leading-relaxed">
            ⚠️ <strong>Anti-Theft Protocol:</strong> Theoretical counts are hidden to ensure unbiased physical counts. Measure remaining quantities carefully.
          </div>

          <div className="space-y-4">
            {rows.map((row, index) => {
              const ing = ingredients.find(i => i.id === row.ingredientId)
              return (
                <div key={row.ingredientId} className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4">
                  <h3 className="font-brand font-bold text-[16px] text-brand-black">
                    {ing?.name}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">
                        Actual Remaining Count ({ing?.unit}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.actualRemaining}
                        onChange={e => handleValueChange(index, 'actualRemaining', Number(e.target.value))}
                        className="w-full h-11 px-3.5 bg-brand-surface border border-brand-border rounded-btn font-body text-[13px] outline-none focus:border-brand-red"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">
                        Reported Wastage Qty ({ing?.unit})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.wastageQty}
                        onChange={e => handleValueChange(index, 'wastageQty', Number(e.target.value))}
                        className="w-full h-11 px-3.5 bg-brand-surface border border-brand-border rounded-btn font-body text-[13px] outline-none focus:border-brand-red"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">
                        Wastage Reason (if wastage &gt; 0)
                      </label>
                      <select
                        value={row.wastageReason}
                        onChange={e => handleValueChange(index, 'wastageReason', e.target.value)}
                        className="w-full h-11 px-2.5 bg-brand-surface border border-brand-border rounded-btn font-body text-[13px] outline-none focus:border-brand-red"
                      >
                        <option value="Expired">Expired / Spoiled</option>
                        <option value="Spilled">Spilled / Damaged</option>
                        <option value="Overcooked">Overcooked / Burned</option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmitClosing}
              disabled={isInventoryLoading}
              className="h-12 px-6 bg-brand-black hover:bg-brand-red disabled:opacity-50 text-white font-brand font-semibold text-[13px] uppercase rounded-btn flex items-center gap-2 transition-colors shadow-sm"
            >
              <Save size={16} />
              {isInventoryLoading ? 'Submitting...' : 'Submit Kitchen Closing'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
