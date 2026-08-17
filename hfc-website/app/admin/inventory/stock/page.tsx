'use client'

import React, { useEffect, useState } from 'react'
import AdminAuthGuard from '@/components/admin/layout/AdminAuthGuard'
import { useInventoryStore, Ingredient, StockEntry } from '@/store/inventoryStore'
import { Plus, Trash2, CheckCircle, Save, ShoppingCart, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import InventoryHeader from '@/components/admin/inventory/InventoryHeader'

interface PurchaseRow {
  ingredientId: string
  inwardQty: number
  supplier: string
  purchaseRate: number
  invoiceNo: string
}

export default function StockPage() {
  return (
    <AdminAuthGuard>
      <StockContent />
    </AdminAuthGuard>
  )
}

function StockContent() {
  const fetchIngredients = useInventoryStore(state => state.fetchIngredients)
  const ingredients = useInventoryStore(state => state.ingredients)
  const addIngredient = useInventoryStore(state => state.addIngredient)
  
  const fetchStockEntries = useInventoryStore(state => state.fetchStockEntriesForDate)
  const saveStockEntries = useInventoryStore(state => state.saveStockEntries)
  const isInventoryLoading = useInventoryStore(state => state.isLoading)

  // System states
  const [todayStr] = useState(() => new Date().toISOString().split('T')[0])
  const [existingStock, setExistingStock] = useState<StockEntry[]>([])
  const [isLoadingPrev, setIsLoadingPrev] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // Inward rows
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([])

  // Modal creation states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('KG')
  const [newCategory, setNewCategory] = useState('Dry')
  const [newCost, setNewCost] = useState(0)
  const [newMinStock, setNewMinStock] = useState(0)

  const loadData = React.useCallback(async () => {
    setIsLoadingPrev(true)
    await fetchIngredients()

    // Get today's logs
    const todayLogs = await fetchStockEntries(todayStr)
    setExistingStock(todayLogs)
    if (todayLogs.length > 0) {
      setIsLocked(true)
    } else {
      // Get yesterday's closing to auto carry-forward
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const yesterdayLogs = await fetchStockEntries(yesterdayStr)
      
      // Seed default entries
      const seeded = todayLogs.length > 0 ? todayLogs : []
      setExistingStock(seeded)
    }
    setIsLoadingPrev(false)
  }, [todayStr, fetchIngredients, fetchStockEntries])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddPurchase = () => {
    if (ingredients.length === 0) {
      toast.error('Create ingredients first!')
      return
    }
    setPurchaseRows([...purchaseRows, {
      ingredientId: ingredients[0].id,
      inwardQty: 1,
      supplier: '',
      purchaseRate: ingredients[0].costPerUnit,
      invoiceNo: ''
    }])
  }

  const handleRemovePurchase = (index: number) => {
    setPurchaseRows(purchaseRows.filter((_, idx) => idx !== index))
  }

  const handlePurchaseChange = (index: number, field: keyof PurchaseRow, value: any) => {
    const updated = [...purchaseRows]
    if (field === 'ingredientId') {
      const ing = ingredients.find(i => i.id === value)
      updated[index] = {
        ...updated[index],
        ingredientId: value,
        purchaseRate: ing ? ing.costPerUnit : updated[index].purchaseRate
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      }
    }
    setPurchaseRows(updated)
  }

  const handleLockStock = async () => {
    // Collect rows to submit
    const entriesToSave = ingredients.map(ing => {
      // Find matching purchase entries
      const matchingPurchases = purchaseRows.filter(p => p.ingredientId === ing.id)
      const inwardQty = matchingPurchases.reduce((acc, p) => acc + p.inwardQty, 0)
      const supplier = matchingPurchases.map(p => p.supplier).filter(Boolean).join(', ')
      const invoiceNo = matchingPurchases.map(p => p.invoiceNo).filter(Boolean).join(', ')
      const purchaseRate = matchingPurchases[0]?.purchaseRate || ing.costPerUnit

      // Carry forward (mock logic: check yesterday summary closing or default 0)
      const openingQty = 0 
      const totalAvailable = openingQty + inwardQty

      return {
        ingredientId: ing.id,
        openingQty,
        inwardQty,
        totalAvailable,
        supplier: supplier || undefined,
        purchaseRate: purchaseRate || undefined,
        invoiceNo: invoiceNo || undefined
      }
    })

    const ok = await saveStockEntries(todayStr, entriesToSave, 'owner')
    if (ok) {
      toast.success('Opening stock confirmed and locked!')
      setIsLocked(true)
      loadData()
    } else {
      toast.error('Failed to confirm stock entries')
    }
  }

  const handleAddIngredientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    const ok = await addIngredient(newName, newUnit, newCategory, newCost, newMinStock)
    if (ok) {
      toast.success(`Ingredient "${newName}" added successfully!`)
      setShowAddModal(false)
      setNewName('')
      setNewCost(0)
      setNewMinStock(0)
    } else {
      toast.error('Failed to create ingredient')
    }
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Dynamic Inventory Layout Subbar Header */}
      <InventoryHeader
        title="Opening Stock Entries"
        description="Verify opening quantities carried forward from yesterday, record today's inward invoice stock, and confirm counts."
      />

      <div className="flex justify-end">
        {!isLocked && (
          <button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-4 bg-brand-black text-white hover:bg-brand-red font-brand font-semibold text-[12px] uppercase rounded-btn flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus size={16} />
            Create Ingredient Master
          </button>
        )}
      </div>

      {isLoadingPrev ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-muted space-y-2">
          <Loader2 className="animate-spin text-brand-red" size={32} />
          <p className="font-body text-[13px]">Fetching inventory balances...</p>
        </div>
      ) : isLocked ? (
        /* Locked status box */
        <div className="bg-green-50 border border-green-200 rounded-card p-6 flex flex-col md:flex-row items-center gap-4 text-green-900 shadow-xs">
          <CheckCircle size={32} className="text-green-600 flex-shrink-0" />
          <div>
            <h3 className="font-brand font-bold text-[16px] leading-tight">Stock Locked For Today</h3>
            <p className="font-body text-[13px] mt-0.5 text-green-800">
              Today&apos;s opening stock values have been verified and submitted. You cannot modify them further to ensure accurate discrepancy reconciliation.
            </p>
          </div>
        </div>
      ) : (
        /* Active Inputs Grid */
        <div className="grid grid-cols-1 gap-6">
          {/* Section 1 - Today Purchases */}
          <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4">
            <h2 className="font-brand font-bold text-[16px] text-brand-black flex items-center gap-2">
              <ShoppingCart size={18} className="text-brand-red" />
              Log Inward Purchases Today
            </h2>

            {purchaseRows.length === 0 ? (
              <div className="text-center py-8 bg-brand-surface border border-dashed border-brand-border rounded-btn text-brand-muted font-body text-[13px]">
                No new purchases logged. If you bought raw materials today, add them below.
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseRows.map((row, index) => (
                  <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-brand-surface border border-brand-border p-3 rounded-btn">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Ingredient</label>
                      <select
                        value={row.ingredientId}
                        onChange={e => handlePurchaseChange(index, 'ingredientId', e.target.value)}
                        className="w-full h-10 px-2.5 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                      >
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-[100px]">
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Inward Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.inwardQty}
                        onChange={e => handlePurchaseChange(index, 'inwardQty', Number(e.target.value))}
                        className="w-full h-10 px-3 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                      />
                    </div>

                    <div className="w-[120px]">
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Rate per Unit (₹)</label>
                      <input
                        type="number"
                        value={row.purchaseRate}
                        onChange={e => handlePurchaseChange(index, 'purchaseRate', Number(e.target.value))}
                        className="w-full h-10 px-3 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                      />
                    </div>

                    <div className="w-[150px]">
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Supplier</label>
                      <input
                        type="text"
                        placeholder="e.g. Local vendor"
                        value={row.supplier}
                        onChange={e => handlePurchaseChange(index, 'supplier', e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                      />
                    </div>

                    <div className="w-[130px]">
                      <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Invoice No</label>
                      <input
                        type="text"
                        placeholder="Invoice ID"
                        value={row.invoiceNo}
                        onChange={e => handlePurchaseChange(index, 'invoiceNo', e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                      />
                    </div>

                    <div className="mt-4 md:mt-0">
                      <button
                        type="button"
                        onClick={() => handleRemovePurchase(index)}
                        className="w-10 h-10 flex items-center justify-center border border-brand-border rounded-btn text-brand-muted hover:text-brand-red hover:bg-brand-redLight transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddPurchase}
              className="w-full py-3 border border-dashed border-brand-red text-brand-red hover:bg-brand-redLight/20 font-brand font-semibold text-[13px] rounded-btn flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Plus size={16} />
              Add Purchase Row
            </button>
          </div>

          {/* Section 2 - Preview Summary & Lock */}
          <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4">
            <h2 className="font-brand font-bold text-[16px] text-brand-black">
              Opening Stock Summary
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-body text-[13px]">
                <thead>
                  <tr className="border-b border-brand-border text-brand-muted">
                    <th className="py-2.5">Ingredient</th>
                    <th className="py-2.5">Unit</th>
                    <th className="py-2.5 text-right">Inward Purchased</th>
                    <th className="py-2.5 text-right">Total Available Today</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => {
                    const rowPurchases = purchaseRows.filter(r => r.ingredientId === ing.id)
                    const inward = rowPurchases.reduce((acc, r) => acc + r.inwardQty, 0)
                    return (
                      <tr key={ing.id} className="border-b border-brand-border hover:bg-brand-surface">
                        <td className="py-3 font-semibold text-brand-black">{ing.name}</td>
                        <td className="py-3 text-brand-muted">{ing.unit}</td>
                        <td className="py-3 text-right font-mono text-brand-black">{inward.toFixed(2)}</td>
                        <td className="py-3 text-right font-mono text-brand-red font-semibold">{inward.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleLockStock}
                disabled={isInventoryLoading || ingredients.length === 0}
                className="h-12 px-6 bg-brand-red hover:bg-brand-redHover disabled:opacity-50 text-white font-brand font-semibold text-[13px] uppercase rounded-btn flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save size={16} />
                {isInventoryLoading ? 'Confirming...' : 'Confirm & Lock Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredient Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-card space-y-4">
            <h3 className="font-brand font-black text-[20px] text-brand-black">
              New Ingredient Master
            </h3>
            <form onSubmit={handleAddIngredientSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Chicken"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full h-11 px-3.5 border border-brand-border rounded-btn font-body text-[13px] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">Measurement Unit</label>
                  <select
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    className="w-full h-11 px-2.5 border border-brand-border rounded-btn font-body text-[13px] outline-none"
                  >
                    <option value="KG">KG (Kilogram)</option>
                    <option value="L">L (Liter)</option>
                    <option value="G">G (Gram)</option>
                    <option value="PCS">PCS (Pieces)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full h-11 px-2.5 border border-brand-border rounded-btn font-body text-[13px] outline-none"
                  >
                    <option value="Protein">Protein</option>
                    <option value="Oil">Oil / Ghee</option>
                    <option value="Dry">Dry Goods</option>
                    <option value="Veg">Vegetables</option>
                    <option value="Spices">Spices</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">Cost per Unit (₹)</label>
                  <input
                    type="number"
                    required
                    value={newCost}
                    onChange={e => setNewCost(Number(e.target.value))}
                    className="w-full h-11 px-3.5 border border-brand-border rounded-btn font-body text-[13px] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-1">Min Alert Stock</label>
                  <input
                    type="number"
                    required
                    value={newMinStock}
                    onChange={e => setNewMinStock(Number(e.target.value))}
                    className="w-full h-11 px-3.5 border border-brand-border rounded-btn font-body text-[13px] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-11 px-4 border border-brand-border rounded-btn font-brand font-semibold text-[12px] uppercase text-brand-body hover:bg-brand-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 bg-brand-black text-white hover:bg-brand-red font-brand font-semibold text-[12px] uppercase rounded-btn"
                >
                  Create Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
