import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export interface Ingredient {
  id: string
  name: string
  unit: string
  category: string
  costPerUnit: number
  minStock: number
  createdAt?: string
}

export interface StockEntry {
  id: string
  date: string
  ingredientId: string
  openingQty: number
  inwardQty: number
  totalAvailable: number
  supplier?: string
  purchaseRate?: number
  invoiceNo?: string
  enteredBy?: string
}

export interface KitchenClosing {
  id: string
  date: string
  ingredientId: string
  theoreticalConsumed: number
  actualRemaining: number
  actualConsumed: number
  wastageReported: number
  wastageReason?: string
  discrepancy: number
  discrepancyValue: number
  submittedBy?: string
  submittedAt?: string
  reviewedByAdmin?: boolean
}

export interface DailyStockSummary {
  id: string
  date: string
  ingredientId: string
  openingQty: number
  inwardQty: number
  theoreticalConsumed: number
  actualConsumed: number
  wastage: number
  closingQty: number
  discrepancy: number
  status: 'ok' | 'warning' | 'critical'
}

interface InventoryStore {
  ingredients: Ingredient[]
  stockEntries: StockEntry[]
  kitchenClosing: KitchenClosing[]
  stockSummaries: DailyStockSummary[]
  isLoading: boolean

  // Actions
  fetchIngredients: () => Promise<void>
  addIngredient: (name: string, unit: string, category: string, costPerUnit: number, minStock: number) => Promise<boolean>
  deleteIngredient: (id: string) => Promise<boolean>
  
  fetchStockEntriesForDate: (date: string) => Promise<StockEntry[]>
  saveStockEntries: (date: string, entries: Omit<StockEntry, 'id' | 'date'>[], enteredBy: string) => Promise<boolean>
  
  fetchKitchenClosingForDate: (date: string) => Promise<KitchenClosing[]>
  submitKitchenClosing: (date: string, closingRecords: Omit<KitchenClosing, 'id' | 'date'>[], submittedBy: string) => Promise<boolean>
  
  fetchStockSummaries: (startDate?: string, endDate?: string) => Promise<void>
  reconcileDailySummary: (date: string) => Promise<boolean>
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      ingredients: [],
      stockEntries: [],
      kitchenClosing: [],
      stockSummaries: [],
      isLoading: false,

      fetchIngredients: async () => {
        set({ isLoading: true })
        try {
          const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .order('name', { ascending: true })

          if (error) throw error
          if (data) {
            set({
              ingredients: data.map((i: any) => ({
                id: i.id,
                name: i.name,
                unit: i.unit,
                category: i.category,
                costPerUnit: Number(i.cost_per_unit),
                minStock: Number(i.min_stock),
                createdAt: i.created_at
              }))
            })
          }
        } catch (err) {
          console.error('Failed to fetch ingredients:', err)
        } finally {
          set({ isLoading: false })
        }
      },

      addIngredient: async (name, unit, category, costPerUnit, minStock) => {
        set({ isLoading: true })
        try {
          const id = `ing-${name.toLowerCase().replace(/\s+/g, '-')}`
          const { error } = await supabase
            .from('ingredients')
            .insert({
              id,
              name,
              unit,
              category,
              cost_per_unit: costPerUnit,
              min_stock: minStock
            })

          if (error) throw error
          await get().fetchIngredients()
          return true
        } catch (err) {
          console.error('Failed to add ingredient:', err)
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      deleteIngredient: async (id) => {
        set({ isLoading: true })
        try {
          const { error } = await supabase
            .from('ingredients')
            .delete()
            .eq('id', id)

          if (error) throw error
          await get().fetchIngredients()
          return true
        } catch (err) {
          console.error('Failed to delete ingredient:', err)
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      fetchStockEntriesForDate: async (date) => {
        try {
          const { data, error } = await supabase
            .from('stock_entries')
            .select('*')
            .eq('date', date)

          if (error) throw error
          if (data) {
            const mapped: StockEntry[] = data.map((s: any) => ({
              id: s.id,
              date: s.date,
              ingredientId: s.ingredient_id,
              openingQty: Number(s.opening_qty),
              inwardQty: Number(s.inward_qty),
              totalAvailable: Number(s.total_available),
              supplier: s.supplier,
              purchaseRate: s.purchase_rate ? Number(s.purchase_rate) : undefined,
              invoiceNo: s.invoice_no,
              enteredBy: s.entered_by
            }))
            return mapped
          }
        } catch (err) {
          console.error('Failed to fetch stock entries:', err)
        }
        return []
      },

      saveStockEntries: async (date, entries, enteredBy) => {
        set({ isLoading: true })
        try {
          // Prepare payload rows
          const rows = entries.map(e => ({
            id: `stk-${date}-${e.ingredientId}`,
            date,
            ingredient_id: e.ingredientId,
            opening_qty: e.openingQty,
            inward_qty: e.inwardQty,
            total_available: e.totalAvailable,
            supplier: e.supplier || null,
            purchase_rate: e.purchaseRate || null,
            invoice_no: e.invoiceNo || null,
            entered_by: enteredBy
          }))

          const { error } = await supabase
            .from('stock_entries')
            .upsert(rows, { onConflict: 'date,ingredient_id' })

          if (error) throw error
          return true
        } catch (err) {
          console.error('Failed to save stock entries:', err)
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      fetchKitchenClosingForDate: async (date) => {
        try {
          const { data, error } = await supabase
            .from('kitchen_closing')
            .select('*')
            .eq('date', date)

          if (error) throw error
          if (data) {
            const mapped: KitchenClosing[] = data.map((k: any) => ({
              id: k.id,
              date: k.date,
              ingredientId: k.ingredient_id,
              theoreticalConsumed: Number(k.theoretical_consumed),
              actualRemaining: Number(k.actual_remaining),
              actualConsumed: Number(k.actual_consumed),
              wastageReported: Number(k.wastage_reported),
              wastageReason: k.wastage_reason,
              discrepancy: Number(k.discrepancy),
              discrepancyValue: Number(k.discrepancy_value),
              submittedBy: k.submitted_by,
              submittedAt: k.submitted_at,
              reviewedByAdmin: k.reviewed_by_admin
            }))
            return mapped
          }
        } catch (err) {
          console.error('Failed to fetch kitchen closing records:', err)
        }
        return []
      },

      submitKitchenClosing: async (date, closingRecords, submittedBy) => {
        set({ isLoading: true })
        try {
          const rows = closingRecords.map(c => ({
            id: `cls-${date}-${c.ingredientId}`,
            date,
            ingredient_id: c.ingredientId,
            theoretical_consumed: c.theoreticalConsumed,
            actual_remaining: c.actualRemaining,
            actual_consumed: c.actualConsumed,
            wastage_reported: c.wastageReported,
            wastage_reason: c.wastageReason || null,
            discrepancy: c.discrepancy,
            discrepancy_value: c.discrepancyValue,
            submitted_by: submittedBy,
            submitted_at: new Date().toISOString()
          }))

          const { error } = await supabase
            .from('kitchen_closing')
            .upsert(rows, { onConflict: 'date,ingredient_id' })

          if (error) throw error

          // Auto trigger summary reconciliation
          await get().reconcileDailySummary(date)
          return true
        } catch (err) {
          console.error('Failed to submit kitchen closing:', err)
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      fetchStockSummaries: async (startDate, endDate) => {
        set({ isLoading: true })
        try {
          let query = supabase
            .from('daily_stock_summary')
            .select('*')
            .order('date', { ascending: false })

          if (startDate) query = query.gte('date', startDate)
          if (endDate) query = query.lte('date', endDate)

          const { data, error } = await query
          if (error) throw error
          if (data) {
            set({
              stockSummaries: data.map((s: any) => ({
                id: s.id,
                date: s.date,
                ingredientId: s.ingredient_id,
                openingQty: Number(s.opening_qty),
                inwardQty: Number(s.inward_qty),
                theoreticalConsumed: Number(s.theoretical_consumed),
                actualConsumed: Number(s.actual_consumed),
                wastage: Number(s.wastage),
                closingQty: Number(s.closing_qty),
                discrepancy: Number(s.discrepancy),
                status: s.status
              }))
            })
          }
        } catch (err) {
          console.error('Failed to fetch stock summaries:', err)
        } finally {
          set({ isLoading: false })
        }
      },

      reconcileDailySummary: async (date) => {
        try {
          // 1. Fetch stock entries for today
          const stock = await get().fetchStockEntriesForDate(date)
          // 2. Fetch kitchen closings for today
          const closing = await get().fetchKitchenClosingForDate(date)

          if (stock.length === 0 || closing.length === 0) {
            console.log('Skipping reconcile: stock or closing missing for date', date)
            return false
          }

          // Generate summary records
          const summaryRows = closing.map(cls => {
            const stk = stock.find(s => s.ingredientId === cls.ingredientId)
            const opening = stk ? stk.openingQty : 0
            const inward = stk ? stk.inwardQty : 0
            
            // Calculate status
            let status: 'ok' | 'warning' | 'critical' = 'ok'
            const discValue = Math.abs(cls.discrepancyValue)
            const available = opening + inward
            const discPercent = available > 0 ? (Math.abs(cls.discrepancy) / available) * 100 : 0
            
            if (discPercent > 8 || discValue > 500) {
              status = 'critical'
            } else if (discPercent > 3 || discValue > 150) {
              status = 'warning'
            }

            return {
              id: `sum-${date}-${cls.ingredientId}`,
              date,
              ingredient_id: cls.ingredientId,
              opening_qty: opening,
              inward_qty: inward,
              theoretical_consumed: cls.theoreticalConsumed,
              actual_consumed: cls.actualConsumed,
              wastage: cls.wastageReported,
              closing_qty: cls.actualRemaining,
              discrepancy: cls.discrepancy,
              status
            }
          })

          const { error } = await supabase
            .from('daily_stock_summary')
            .upsert(summaryRows, { onConflict: 'date,ingredient_id' })

          if (error) throw error
          return true
        } catch (err) {
          console.error('Reconciliation failed:', err)
          return false
        }
      }
    }),
    {
      name: 'hfc-inventory'
    }
  )
)
