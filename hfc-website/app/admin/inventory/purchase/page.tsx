'use client'

import React, { useEffect, useState } from 'react'
import AdminAuthGuard from '@/components/admin/layout/AdminAuthGuard'
import { useInventoryStore, Ingredient, KitchenClosing, DailyStockSummary } from '@/store/inventoryStore'
import { generatePurchasePlan, PurchasePlanItem } from '@/lib/inventoryHelpers'
import { Clipboard, Send, IndianRupee, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import InventoryHeader from '@/components/admin/inventory/InventoryHeader'

export default function PurchasePage() {
  return (
    <AdminAuthGuard>
      <PurchaseContent />
    </AdminAuthGuard>
  )
}

function PurchaseContent() {
  const fetchIngredients = useInventoryStore(state => state.fetchIngredients)
  const ingredients = useInventoryStore(state => state.ingredients)
  
  const fetchKitchenClosing = useInventoryStore(state => state.fetchKitchenClosingForDate)
  const fetchSummaries = useInventoryStore(state => state.fetchStockSummaries)
  const stockSummaries = useInventoryStore(state => state.stockSummaries)

  const [todayStr] = useState(() => new Date().toISOString().split('T')[0])
  const [closingRecords, setClosingRecords] = useState<KitchenClosing[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Local editable purchase plan list
  const [purchaseList, setPurchaseList] = useState<PurchasePlanItem[]>([])

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    await fetchIngredients()
    
    const cls = await fetchKitchenClosing(todayStr)
    setClosingRecords(cls)

    // Fetch summaries to compute historic averages
    await fetchSummaries()
    setIsLoading(false)
  }, [todayStr, fetchIngredients, fetchKitchenClosing, fetchSummaries])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Compute purchase list once loading finishes
  useEffect(() => {
    if (ingredients.length > 0) {
      // Map historical records from summaries
      const pastList = stockSummaries.map(s => ({
        date: s.date,
        ingredientId: s.ingredientId,
        actualConsumed: s.actualConsumed
      }))

      const plan = generatePurchasePlan(ingredients, closingRecords, pastList)
      setPurchaseList(plan)
    }
  }, [ingredients, closingRecords, stockSummaries])

  const handleQtyChange = (index: number, val: number) => {
    const updated = [...purchaseList]
    const p = updated[index]
    const purchaseQty = Math.max(0, val)
    updated[index] = {
      ...p,
      purchaseQty,
      estimatedCost: purchaseQty * p.costPerUnit
    }
    setPurchaseList(updated)
  }

  // Calculate total purchase cost
  const totalCost = purchaseList.reduce((acc, p) => acc + p.estimatedCost, 0)

  // Format WhatsApp message text
  const getWhatsAppMessage = () => {
    const tomorrowStr = new Date()
    tomorrowStr.setDate(tomorrowStr.getDate() + 1)
    const formattedDate = tomorrowStr.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

    let text = `📦 *HFC Purchase List — ${formattedDate}*\n\n`
    purchaseList.forEach(p => {
      if (p.purchaseQty > 0) {
        text += `🍗 *${p.ingredientName}*: ${p.purchaseQty} ${p.unit} (est: ₹${p.estimatedCost.toFixed(0)})\n`
      }
    })
    text += `\n*Total Est Procurement Cost: ₹${totalCost.toFixed(0)}*\n\n`
    text += `Generated automatically by HFC Cloud Kitchen System.`
    return encodeURIComponent(text)
  }

  const handleSendWhatsApp = () => {
    const settings = useInventoryStore.getState()
    const whatsappNum = '919912799855' // Merchant default phone number
    const msg = getWhatsAppMessage()
    window.open(`https://wa.me/${whatsappNum}?text=${msg}`, '_blank')
    toast.success('WhatsApp purchase plan opened!')
  }

  const handleCopyClipboard = () => {
    const msg = decodeURIComponent(getWhatsAppMessage())
    navigator.clipboard.writeText(msg)
    toast.success('Purchase list copied to clipboard!')
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Dynamic Inventory Layout Subbar Header */}
      <InventoryHeader
        title="Purchase Projections"
        description="Forecast tomorrow's required raw materials based on EOD stock balances and past consumption."
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-body text-[13px] text-brand-body">
          Select export options below:
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyClipboard}
            className="h-10 px-4 border border-brand-border bg-white text-brand-body hover:border-brand-black hover:text-brand-black font-brand font-semibold text-[12px] uppercase rounded-btn flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Clipboard size={16} />
            Copy Purchase List
          </button>
          <button
            onClick={handleSendWhatsApp}
            className="h-10 px-4 bg-brand-whatsapp hover:bg-[#1da851] text-white font-brand font-semibold text-[12px] uppercase rounded-btn flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Send size={16} />
            Send via WhatsApp
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-muted space-y-2">
          <Loader2 className="animate-spin text-brand-red" size={32} />
          <p className="font-body text-[13px]">Calculating procurements...</p>
        </div>
      ) : purchaseList.length === 0 ? (
        <div className="text-center py-16 bg-white border border-brand-border rounded-card text-brand-muted font-body text-[13px]">
          No ingredients configured. Go to Recipes or Opening Stock to seed master entries.
        </div>
      ) : (
        /* Purchase List Table Card */
        <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-brand-border pb-4">
            <div>
              <h2 className="font-brand font-bold text-[16px] text-brand-black">
                Procurement Estimates
              </h2>
            </div>
            <div className="bg-brand-surface border border-brand-border p-3 rounded-btn text-right min-w-[150px]">
              <p className="font-body text-[11px] text-brand-muted leading-none">Estimated Total Cost</p>
              <p className="font-brand font-bold text-[20px] text-brand-black mt-1 flex items-center justify-end">
                <IndianRupee size={15} className="text-brand-red" />
                {totalCost.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-body text-[13px]">
              <thead>
                <tr className="border-b border-brand-border text-brand-muted">
                  <th className="py-2.5">Ingredient</th>
                  <th className="py-2.5 text-right">EOD Stock</th>
                  <th className="py-2.5 text-right">Avg Daily Consumption</th>
                  <th className="py-2.5 text-right">Projected Need</th>
                  <th className="py-2.5 w-[140px] text-right">Purchase Qty</th>
                  <th className="py-2.5 text-right">Cost Estimate</th>
                </tr>
              </thead>
              <tbody>
                {purchaseList.map((p, index) => (
                  <tr key={p.ingredientId} className="border-b border-brand-border hover:bg-brand-surface">
                    <td className="py-3 font-semibold text-brand-black">{p.ingredientName}</td>
                    <td className="py-3 text-right font-mono text-brand-muted">{p.closingStock.toFixed(2)} {p.unit}</td>
                    <td className="py-3 text-right font-mono text-brand-muted">{p.avgDailyConsumed.toFixed(2)} {p.unit}</td>
                    <td className="py-3 text-right font-mono text-brand-black">{p.projectedNeed.toFixed(2)} {p.unit}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={p.purchaseQty}
                        onChange={e => handleQtyChange(index, Number(e.target.value))}
                        className="w-[100px] h-9 px-2 bg-brand-surface border border-brand-border rounded-btn font-mono text-[13px] text-right focus:border-brand-red outline-none"
                      />
                    </td>
                    <td className="py-3 text-right font-brand font-bold text-brand-black">₹{p.estimatedCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
