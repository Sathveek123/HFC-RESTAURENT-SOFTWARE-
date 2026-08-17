'use client'

import React, { useEffect, useState } from 'react'
import AdminAuthGuard from '@/components/admin/layout/AdminAuthGuard'
import { useProductsStore, ProductItem } from '@/store/productsStore'
import { useRecipeStore, RecipeItem } from '@/store/recipeStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { Plus, Trash2, Save, Utensils, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'

import InventoryHeader from '@/components/admin/inventory/InventoryHeader'

interface RecipeRow {
  ingredientId: string
  quantity: number
  unit: string
}

export default function RecipesPage() {
  return (
    <AdminAuthGuard>
      <RecipesContent />
    </AdminAuthGuard>
  )
}

function RecipesContent() {
  const fetchProducts = useProductsStore(state => state.fetchAndSyncProducts)
  const products = useProductsStore(state => state.items)
  
  const fetchRecipes = useRecipeStore(state => state.fetchRecipes)
  const recipes = useRecipeStore(state => state.recipes)
  const saveRecipe = useRecipeStore(state => state.saveRecipeIngredients)
  const isRecipeLoading = useRecipeStore(state => state.isLoading)

  const fetchIngredients = useInventoryStore(state => state.fetchIngredients)
  const ingredients = useInventoryStore(state => state.ingredients)
  const isInventoryLoading = useInventoryStore(state => state.isLoading)

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([])

  useEffect(() => {
    fetchProducts()
    fetchRecipes()
    fetchIngredients()
  }, [fetchProducts, fetchRecipes, fetchIngredients])

  // Hydrate recipe rows when product selection changes
  useEffect(() => {
    if (selectedProduct) {
      const existing = recipes.filter(r => r.productId === selectedProduct.id)
      if (existing.length > 0) {
        setRecipeRows(existing.map(r => ({
          ingredientId: r.ingredientId,
          quantity: r.quantityPerUnit,
          unit: r.unit
        })))
      } else {
        setRecipeRows([])
      }
    } else {
      setRecipeRows([])
    }
  }, [selectedProduct, recipes])

  const handleAddRow = () => {
    if (ingredients.length === 0) {
      toast.error('Please create ingredients first!')
      return
    }
    const defaultIng = ingredients[0]
    setRecipeRows([...recipeRows, {
      ingredientId: defaultIng.id,
      quantity: 0.1,
      unit: defaultIng.unit
    }])
  }

  const handleRemoveRow = (index: number) => {
    setRecipeRows(recipeRows.filter((_, idx) => idx !== index))
  }

  const handleRowChange = (index: number, field: keyof RecipeRow, value: any) => {
    const updated = [...recipeRows]
    if (field === 'ingredientId') {
      const ing = ingredients.find(i => i.id === value)
      updated[index] = {
        ...updated[index],
        ingredientId: value,
        unit: ing ? ing.unit : updated[index].unit
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      }
    }
    setRecipeRows(updated)
  }

  const handleSave = async () => {
    if (!selectedProduct) return

    // Validate rows
    for (const r of recipeRows) {
      if (r.quantity <= 0) {
        toast.error('Quantities must be greater than zero')
        return
      }
    }

    const payload = recipeRows.map(r => ({
      ingredientId: r.ingredientId,
      quantityPerUnit: r.quantity,
      unit: r.unit
    }))

    const success = await saveRecipe(selectedProduct.id, selectedProduct.name, payload)
    if (success) {
      toast.success('Recipe updated successfully')
    } else {
      toast.error('Failed to save recipe')
    }
  }

  // Calculate dynamic recipe cost
  const recipeCost = recipeRows.reduce((acc, row) => {
    const ing = ingredients.find(i => i.id === row.ingredientId)
    const cost = ing ? ing.costPerUnit * row.quantity : 0
    return acc + cost
  }, 0)

  const foodCostPercent = selectedProduct && selectedProduct.price > 0
    ? Math.round((recipeCost / selectedProduct.price) * 100)
    : 0

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Dynamic Inventory Layout Subbar Header */}
      <InventoryHeader
        title="Recipe Mapping Config"
        description="Map menu items to raw material recipe quantities to automatically deduct ingredients from completed orders."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-6 items-start">
        {/* Left Pane - Products List */}
        <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4">
          <h2 className="font-brand font-bold text-[16px] text-brand-black flex items-center gap-2">
            <Utensils size={18} className="text-brand-red" />
            Select Menu Dish
          </h2>
          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2">
            {products.map(p => {
              const count = recipes.filter(r => r.productId === p.id).length
              const isSelected = selectedProduct?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`w-full p-4 rounded-btn border text-left flex justify-between items-center transition-all ${
                    isSelected
                      ? 'border-brand-red bg-brand-redLight'
                      : 'border-brand-border hover:border-brand-red/40 bg-brand-surface'
                  }`}
                >
                  <div>
                    <p className={`font-brand font-semibold text-[14px] ${isSelected ? 'text-brand-red' : 'text-brand-black'}`}>
                      {p.name}
                    </p>
                    <p className="font-body text-[12px] text-brand-muted mt-0.5">
                      Price: ₹{p.price} | {p.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                    </p>
                  </div>
                  <span className={`text-[11px] font-brand font-medium px-2 py-1 rounded-[4px] ${
                    count > 0 ? 'bg-green-100 text-green-800' : 'bg-brand-border text-brand-muted'
                  }`}>
                    {count > 0 ? `${count} mapped` : 'unmapped'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Pane - Recipe Config */}
        <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs min-h-[450px]">
          {selectedProduct ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-brand-border pb-4">
                <div>
                  <h2 className="font-brand font-bold text-[18px] text-brand-black">
                    Recipe for {selectedProduct.name}
                  </h2>
                  <p className="font-body text-[12px] text-brand-muted mt-0.5">
                    Menu Price: ₹{selectedProduct.price}
                  </p>
                </div>

                {/* KPI block */}
                <div className="flex gap-4">
                  <div className="bg-brand-surface border border-brand-border p-3 rounded-btn text-right min-w-[120px]">
                    <p className="font-body text-[11px] text-brand-muted leading-none">Food Cost</p>
                    <p className="font-brand font-bold text-[18px] text-brand-black mt-1 flex items-center justify-end">
                      <IndianRupee size={14} className="text-brand-red" />
                      {recipeCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-brand-surface border border-brand-border p-3 rounded-btn text-right min-w-[100px]">
                    <p className="font-body text-[11px] text-brand-muted leading-none">Cost %</p>
                    <p className={`font-brand font-bold text-[18px] mt-1 ${
                      foodCostPercent > 40 ? 'text-brand-red' : foodCostPercent > 25 ? 'text-brand-gold' : 'text-green-700'
                    }`}>
                      {foodCostPercent}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Recipe rows */}
              <div className="space-y-3">
                {recipeRows.length === 0 ? (
                  <div className="text-center py-12 bg-brand-surface border border-dashed border-brand-border rounded-btn text-brand-muted font-body text-[13px]">
                    No ingredients mapped yet. Click button below to configure recipe.
                  </div>
                ) : (
                  recipeRows.map((row, index) => {
                    const ing = ingredients.find(i => i.id === row.ingredientId)
                    const lineCost = ing ? ing.costPerUnit * row.quantity : 0
                    return (
                      <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-brand-surface border border-brand-border p-3 rounded-btn">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Ingredient</label>
                          <select
                            value={row.ingredientId}
                            onChange={e => handleRowChange(index, 'ingredientId', e.target.value)}
                            className="w-full h-10 px-2.5 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                          >
                            {ingredients.map(i => (
                              <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                            ))}
                          </select>
                        </div>

                        <div className="w-[180px]">
                          <label className="block text-[10px] font-brand font-semibold text-brand-muted mb-0.5">Qty (e.g. 0.250 for 250g)</label>
                          <input
                            type="number"
                            step="0.001"
                            value={row.quantity}
                            onChange={e => handleRowChange(index, 'quantity', Number(e.target.value))}
                            className="w-full h-10 px-3 bg-white border border-brand-border rounded-btn font-body text-[13px] outline-none"
                          />
                        </div>

                        <div className="w-[70px]">
                          <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Unit</label>
                          <span className="h-10 border border-brand-border bg-white rounded-btn px-3 flex items-center font-body text-[13px] text-brand-muted">
                            {row.unit}
                          </span>
                        </div>

                        <div className="w-[100px] text-right">
                          <label className="block text-[11px] font-brand font-semibold text-brand-muted mb-0.5">Cost</label>
                          <span className="h-10 font-brand font-bold text-[14px] text-brand-black flex items-center justify-end">
                            ₹{lineCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="mt-4 md:mt-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="w-10 h-10 flex items-center justify-center border border-brand-border rounded-btn text-brand-muted hover:text-brand-red hover:bg-brand-redLight transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full py-3 border border-dashed border-brand-red text-brand-red hover:bg-brand-redLight/20 font-brand font-semibold text-[13px] rounded-btn flex items-center justify-center gap-2 transition-colors mt-2"
                >
                  <Plus size={16} />
                  Add Ingredient Row
                </button>
              </div>

              {/* Save footer */}
              <div className="border-t border-brand-border pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isRecipeLoading}
                  className="h-12 px-6 bg-brand-red hover:bg-brand-redHover disabled:opacity-50 text-white font-brand font-semibold text-[13px] uppercase rounded-btn flex items-center gap-2 transition-colors"
                >
                  <Save size={16} />
                  {isRecipeLoading ? 'Saving...' : 'Save Recipe Configuration'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-24 text-brand-muted space-y-3">
              <Utensils size={36} className="text-brand-border" />
              <p className="font-brand font-semibold text-[15px]">No Dish Selected</p>
              <p className="font-body text-[13px] max-w-[280px]">
                Please select a menu dish from the left pane to configure its recipes and raw ingredients.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
