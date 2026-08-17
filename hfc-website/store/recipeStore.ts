import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export interface RecipeItem {
  id: string
  productId: string
  productName: string
  ingredientId: string
  quantityPerUnit: number
  unit: string
  createdAt?: string
}

interface RecipeStore {
  recipes: RecipeItem[]
  isLoading: boolean
  
  // Actions
  fetchRecipes: () => Promise<void>
  saveRecipeIngredients: (productId: string, productName: string, ingredients: Omit<RecipeItem, 'id' | 'productId' | 'productName'>[]) => Promise<boolean>
  getIngredientsForProduct: (productId: string) => RecipeItem[]
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: [],
      isLoading: false,

      fetchRecipes: async () => {
        set({ isLoading: true })
        try {
          const { data, error } = await supabase
            .from('recipes')
            .select('*')
          
          if (error) throw error
          
          if (data) {
            const mapped: RecipeItem[] = data.map((r: any) => ({
              id: r.id,
              productId: r.product_id,
              productName: r.product_name,
              ingredientId: r.ingredient_id,
              quantityPerUnit: Number(r.quantity_per_unit),
              unit: r.unit,
              createdAt: r.created_at
            }))
            set({ recipes: mapped })
          }
        } catch (err) {
          console.error('Failed to fetch recipes:', err)
        } finally {
          set({ isLoading: false })
        }
      },

      saveRecipeIngredients: async (productId, productName, ingredients) => {
        set({ isLoading: true })
        try {
          // 1. Delete existing recipe mappings for this product in Supabase
          const { error: deleteErr } = await supabase
            .from('recipes')
            .delete()
            .eq('product_id', productId)

          if (deleteErr) throw deleteErr

          if (ingredients.length === 0) {
            // Update local state
            set({
              recipes: get().recipes.filter(r => r.productId !== productId)
            })
            return true
          }

          // 2. Insert new ingredients mapping
          const newRows = ingredients.map(ing => ({
            id: `rec-${productId}-${ing.ingredientId}`,
            product_id: productId,
            product_name: productName,
            ingredient_id: ing.ingredientId,
            quantity_per_unit: ing.quantityPerUnit,
            unit: ing.unit,
          }))

          const { error: insertErr } = await supabase
            .from('recipes')
            .insert(newRows)

          if (insertErr) throw insertErr

          // Re-fetch all to keep synchronized
          await get().fetchRecipes()
          return true
        } catch (err) {
          console.error('Failed to save recipe:', err)
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      getIngredientsForProduct: (productId) => {
        return get().recipes.filter(r => r.productId === productId)
      }
    }),
    {
      name: 'hfc-recipes'
    }
  )
)
