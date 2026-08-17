'use client'

import React, { useEffect, useState } from 'react'
import AdminAuthGuard from '@/components/admin/layout/AdminAuthGuard'
import { useInventoryStore, Ingredient, StockEntry, KitchenClosing } from '@/store/inventoryStore'
import { useRecipeStore } from '@/store/recipeStore'
import { useOrderStore } from '@/store/orderStore'
import { calculateTheoreticalConsumption, generateDiscrepancyReport } from '@/lib/inventoryHelpers'
import { Plus, Settings, AlertTriangle, AlertCircle, TrendingDown, Layers, FileText, CheckCircle } from 'lucide-react'
import InventoryHeader from '@/components/admin/inventory/InventoryHeader'

export default function InventoryDashboard() {
  return (
    <AdminAuthGuard>
      <DashboardContent />
    </AdminAuthGuard>
  )
}

function DashboardContent() {
  const fetchIngredients = useInventoryStore(state => state.fetchIngredients)
  const ingredients = useInventoryStore(state => state.ingredients)
  
  const fetchStockEntries = useInventoryStore(state => state.fetchStockEntriesForDate)
  const fetchKitchenClosing = useInventoryStore(state => state.fetchKitchenClosingForDate)

  const fetchRecipes = useRecipeStore(state => state.fetchRecipes)
  const recipes = useRecipeStore(state => state.recipes)

  const orders = useOrderStore(state => state.orders)

  // Local state
  const [todayStr] = useState(() => new Date().toISOString().split('T')[0])
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([])
  const [closingRecords, setClosingRecords] = useState<KitchenClosing[]>([])
  const [isDataLoading, setIsDataLoading] = useState(false)

  const loadData = React.useCallback(async () => {
    setIsDataLoading(true)
    await fetchIngredients()
    await fetchRecipes()
    
    const stk = await fetchStockEntries(todayStr)
    setStockEntries(stk)

    const cls = await fetchKitchenClosing(todayStr)
    setClosingRecords(cls)
    setIsDataLoading(false)
  }, [todayStr, fetchIngredients, fetchRecipes, fetchStockEntries, fetchKitchenClosing])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 1. Calculate today's orders
  const todayOrders = orders.filter(o => {
    if (!o.createdAt) return false
    return o.createdAt.startsWith(todayStr)
  })

  // 2. Compute theoretical consumption dynamically
  const theoreticalConsumptionMap = calculateTheoreticalConsumption(todayOrders, recipes)

  // 3. Compute discrepancies report
  const discrepancyReports = generateDiscrepancyReport(
    ingredients,
    stockEntries,
    theoreticalConsumptionMap,
    closingRecords
  )

  // 4. Calculate dashboard KPIs
  const totalStockValue = stockEntries.reduce((acc, row) => {
    const ing = ingredients.find(i => i.id === row.ingredientId)
    const rate = ing ? ing.costPerUnit : 0
    return acc + row.totalAvailable * rate
  }, 0)

  const totalTheoreticalCost = Array.from(theoreticalConsumptionMap.entries()).reduce((acc, [id, qty]) => {
    const ing = ingredients.find(i => i.id === id)
    const rate = ing ? ing.costPerUnit : 0
    return acc + qty * rate
  }, 0)

  const activeDiscrepancies = discrepancyReports.filter(r => r.status !== 'ok' && closingRecords.length > 0)
  const hasSubmittedClosing = closingRecords.length > 0

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Dynamic Inventory Layout Subbar Header */}
      <InventoryHeader
        title="Inventory Dashboard"
        description="Real-time theoretical consumption tracking and ingredient alerts for HFC Restaurant Software."
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-brand-border p-5 rounded-card shadow-xs">
          <p className="font-body text-[11px] text-brand-muted uppercase tracking-[1px]">Available Stock Value</p>
          <p className="font-brand font-black text-[24px] text-brand-black mt-1">₹{totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="font-body text-[12px] text-brand-muted mt-2">Active opening + inward logged</p>
        </div>

        <div className="bg-white border border-brand-border p-5 rounded-card shadow-xs">
          <p className="font-body text-[11px] text-brand-muted uppercase tracking-[1px]">Order Consumption Cost</p>
          <p className="font-brand font-black text-[24px] text-brand-red mt-1">₹{totalTheoreticalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="font-body text-[12px] text-brand-muted mt-2">Theoretical value from {todayOrders.length} orders</p>
        </div>

        <div className="bg-white border border-brand-border p-5 rounded-card shadow-xs">
          <p className="font-body text-[11px] text-brand-muted uppercase tracking-[1px]">Daily Sales Orders</p>
          <p className="font-brand font-black text-[24px] text-brand-black mt-1">{todayOrders.length} orders</p>
          <p className="font-body text-[12px] text-brand-muted mt-2">Live transaction triggers today</p>
        </div>

        <div className="bg-white border border-brand-border p-5 rounded-card shadow-xs">
          <p className="font-body text-[11px] text-brand-muted uppercase tracking-[1px]">Kitchen closing status</p>
          <div className="flex items-center gap-2 mt-1.5">
            {hasSubmittedClosing ? (
              <>
                <CheckCircle size={20} className="text-green-600" />
                <span className="font-brand font-bold text-[16px] text-green-700">Submitted</span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-brand-gold animate-pulse" />
                <span className="font-brand font-bold text-[16px] text-brand-gold">Awaiting closing</span>
              </>
            )}
          </div>
          <p className="font-body text-[12px] text-brand-muted mt-2">Required at closing (after 6 PM)</p>
        </div>
      </div>

      {/* Discrepancy Warnings Box */}
      {hasSubmittedClosing && activeDiscrepancies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-brand-red">
            <AlertTriangle size={20} />
            <h3 className="font-brand font-bold text-[15px] leading-none">Wastage / Discrepancy Alerts</h3>
          </div>
          <p className="font-body text-[13px] text-brand-body">
            The kitchen staff submitted physical remaining counts today that differ from theoretical calculations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDiscrepancies.map(row => (
              <div key={row.ingredientId} className="bg-white border border-red-100 p-3 rounded-btn flex items-center justify-between">
                <div>
                  <p className="font-brand font-semibold text-[13px] text-brand-black">{row.ingredientName}</p>
                  <p className="font-body text-[11px] text-brand-muted mt-0.5">
                    Unexplained loss: {row.discrepancy.toFixed(3)} {row.unit}
                  </p>
                </div>
                <span className="font-brand font-bold text-[14px] text-brand-red">
                  -₹{Math.abs(row.discrepancyValue).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live consumption table */}
      <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-brand font-bold text-[16px] text-brand-black flex items-center gap-2">
            <TrendingDown size={18} className="text-brand-red" />
            Live Consumption Tracker (Today)
          </h2>
          <span className="font-body text-[11px] text-brand-muted uppercase tracking-[0.5px]">
            Live dynamic updates
          </span>
        </div>

        {stockEntries.length === 0 ? (
          <div className="text-center py-16 bg-brand-surface border border-dashed border-brand-border rounded-btn text-brand-muted font-body text-[13px] space-y-2">
            <AlertCircle size={28} className="text-brand-muted mx-auto" />
            <p className="font-brand font-semibold">No stock values entered today</p>
            <p className="font-body text-[12px] max-w-[280px] mx-auto">
              Please enter opening inventory balance and purchases first to populate the running consumption log.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body text-[13px]">
              <thead>
                <tr className="border-b border-brand-border text-brand-muted">
                  <th className="py-2.5">Ingredient</th>
                  <th className="py-2.5">Available Today</th>
                  <th className="py-2.5 text-right">Theoretical Consumed</th>
                  <th className="py-2.5 text-right">Theoretical Remaining</th>
                  <th className="py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map(ing => {
                  const entry = stockEntries.find(s => s.ingredientId === ing.id)
                  const total = entry ? entry.totalAvailable : 0
                  const consumed = theoreticalConsumptionMap.get(ing.id) || 0
                  const remaining = Math.max(0, total - consumed)
                  
                  const isLow = remaining < ing.minStock
                  
                  return (
                    <tr key={ing.id} className="border-b border-brand-border hover:bg-brand-surface">
                      <td className="py-3 font-semibold text-brand-black">{ing.name}</td>
                      <td className="py-3 font-mono text-brand-body">{total.toFixed(2)} {ing.unit}</td>
                      <td className="py-3 text-right font-mono text-brand-black">{consumed.toFixed(2)} {ing.unit}</td>
                      <td className="py-3 text-right font-mono font-semibold text-brand-black">{remaining.toFixed(2)} {ing.unit}</td>
                      <td className="py-3 text-right">
                        <span className={`text-[10px] font-brand font-bold uppercase px-2 py-0.5 rounded-[4px] ${
                          isLow ? 'bg-red-100 text-brand-red' : 'bg-green-100 text-brand-green'
                        }`}>
                          {isLow ? 'Low Stock' : 'Sufficient'}
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
    </div>
  )
}
