import { OrderRecord } from '@/store/orderStore'
import { RecipeItem } from '@/store/recipeStore'
import { Ingredient, StockEntry, KitchenClosing } from '@/store/inventoryStore'

export interface DiscrepancyResult {
  ingredientId: string
  ingredientName: string
  unit: string
  costPerUnit: number
  totalAvailable: number
  theoreticalConsumed: number
  theoreticalRemaining: number
  actualRemaining: number
  wastageReported: number
  actualConsumed: number
  discrepancy: number
  discrepancyValue: number
  discrepancyPercent: number
  status: 'ok' | 'warning' | 'critical'
}

/**
 * Calculates theoretical raw materials consumed today from a list of placed orders and recipe mappings
 */
export function calculateTheoreticalConsumption(
  orders: OrderRecord[],
  recipes: RecipeItem[]
): Map<string, number> {
  const consumption = new Map<string, number>()

  // Only count orders that are not rejected or cancelled
  const validOrders = orders.filter(
    o => o.status !== 'rejected' && o.status !== 'cancelled'
  )

  for (const order of validOrders) {
    for (const item of order.items) {
      // Find recipe rows for this product
      const recipeRows = recipes.filter(r => r.productId === item.id)
      for (const row of recipeRows) {
        const current = consumption.get(row.ingredientId) || 0
        consumption.set(
          row.ingredientId,
          current + Number(row.quantityPerUnit) * item.quantity
        )
      }
    }
  }

  return consumption
}

/**
 * Generates the discrepancy review report for the owner
 */
export function generateDiscrepancyReport(
  ingredients: Ingredient[],
  stockEntries: StockEntry[],
  theoreticalConsumption: Map<string, number>,
  closingRecords: KitchenClosing[]
): DiscrepancyResult[] {
  return ingredients.map(ing => {
    const stk = stockEntries.find(s => s.ingredientId === ing.id)
    const cls = closingRecords.find(c => c.ingredientId === ing.id)

    const totalAvailable = stk ? stk.totalAvailable : 0
    const theoreticalConsumed = theoreticalConsumption.get(ing.id) || 0
    const actualRemaining = cls ? cls.actualRemaining : 0
    const wastageReported = cls ? cls.wastageReported : 0

    // Calculations
    const theoreticalRemaining = Math.max(0, totalAvailable - theoreticalConsumed)
    const actualConsumed = Math.max(0, totalAvailable - actualRemaining)
    
    // Discrepancy is actual consumed minus expected accounted amount
    // discrepancy > 0 means the kitchen used MORE than accounted for (theft / unaccounted waste)
    const expectedConsumed = theoreticalConsumed + wastageReported
    const discrepancy = actualConsumed - expectedConsumed
    const discrepancyValue = discrepancy * ing.costPerUnit
    const discrepancyPercent = totalAvailable > 0 ? (discrepancy / totalAvailable) * 100 : 0

    // Categorization
    let status: 'ok' | 'warning' | 'critical' = 'ok'
    const absPercent = Math.abs(discrepancyPercent)
    const absValue = Math.abs(discrepancyValue)

    if (absPercent > 8 || absValue > 500) {
      status = 'critical'
    } else if (absPercent > 3 || absValue > 150) {
      status = 'warning'
    }

    return {
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.unit,
      costPerUnit: ing.costPerUnit,
      totalAvailable,
      theoreticalConsumed,
      theoreticalRemaining,
      actualRemaining,
      wastageReported,
      actualConsumed,
      discrepancy,
      discrepancyValue,
      discrepancyPercent,
      status
    }
  })
}

export interface PurchasePlanItem {
  ingredientId: string
  ingredientName: string
  unit: string
  closingStock: number
  avgDailyConsumed: number
  projectedNeed: number
  purchaseQty: number
  costPerUnit: number
  estimatedCost: number
}

/**
 * Generates the purchasing needs for tomorrow based on historic orders
 */
export function generatePurchasePlan(
  ingredients: Ingredient[],
  closingRecords: KitchenClosing[],
  pastSummaries: { date: string; ingredientId: string; actualConsumed: number }[]
): PurchasePlanItem[] {
  const plan: PurchasePlanItem[] = []

  // Group past summary records by ingredientId
  const historyMap = new Map<string, number[]>()
  for (const s of pastSummaries) {
    const list = historyMap.get(s.ingredientId) || []
    list.push(s.actualConsumed)
    historyMap.set(s.ingredientId, list)
  }

  for (const ing of ingredients) {
    const cls = closingRecords.find(c => c.ingredientId === ing.id)
    const closingQty = cls ? cls.actualRemaining : 0

    // Calculate historic 7-day average
    const actuals = historyMap.get(ing.id) || []
    const sum = actuals.reduce((acc, v) => acc + v, 0)
    const avgDaily = actuals.length > 0 ? sum / actuals.length : ing.minStock * 0.5 // fallback

    // Projected need = 1.2 x average consumption (20% buffer)
    const projectedNeed = Math.round(avgDaily * 1.2 * 100) / 100

    // Purchase quantity must satisfy projected need + min stock buffer
    const rawPurchase = (projectedNeed + ing.minStock) - closingQty
    const purchaseQty = Math.max(0, Math.round(rawPurchase * 100) / 100)
    const estimatedCost = purchaseQty * ing.costPerUnit

    plan.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.unit,
      closingStock: closingQty,
      avgDailyConsumed: Math.round(avgDaily * 100) / 100,
      projectedNeed,
      purchaseQty,
      costPerUnit: ing.costPerUnit,
      estimatedCost
    })
  }

  return plan
}
