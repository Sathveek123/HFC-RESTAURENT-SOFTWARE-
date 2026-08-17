'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Search, Flame, Circle } from 'lucide-react'
import { useProductsStore } from '@/store/productsStore'
import { useTableStore } from '@/store/tableStore'
import { subscribeToProductsRealtime } from '@/lib/supabaseSync'

export default function TableMenuBrowser() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchAndSyncProducts = useProductsStore(state => state.fetchAndSyncProducts)
  const upsertProductFromSupabase = useProductsStore(state => state.upsertProductFromSupabase)
  const removeProductFromSupabase = useProductsStore(state => state.removeProductFromSupabase)
  const rawItems = useProductsStore(state => state.items)

  const cartItems = useTableStore(state => state.cartItems)
  const addToCart = useTableStore(state => state.addToCart)
  const updateCartQuantity = useTableStore(state => state.updateCartQuantity)

  useEffect(() => {
    fetchAndSyncProducts()
    const unsubscribe = subscribeToProductsRealtime(
      upsertProductFromSupabase,
      removeProductFromSupabase
    )
    return () => unsubscribe()
  }, [fetchAndSyncProducts, upsertProductFromSupabase, removeProductFromSupabase])

  // Extract unique categories from items
  const categories = useMemo(() => {
    const activeProducts = rawItems.filter(i => i.isAvailable)
    const cats = Array.from(new Set(activeProducts.map(item => item.categoryId)))
    return ['all', ...cats]
  }, [rawItems])

  // Filter items based on activeCategory and searchQuery
  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      if (!item.isAvailable) return false

      const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [rawItems, activeCategory, searchQuery])

  return (
    <div className="space-y-6 pb-28">
      {/* Search and Filter Section */}
      <div className="px-4 pt-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search delicious food..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAFAFA] border border-brand-border rounded-[12px] pl-10 pr-4 py-3 text-[14px] font-body focus:outline-brand-red focus:bg-white transition-all shadow-xs"
          />
          <Search size={18} className="absolute left-3.5 top-3.5 text-brand-muted" />
        </div>
      </div>

      {/* Category Tabs */}
      {searchQuery.trim() === '' && (
        <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
          {categories.map(cat => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full font-brand font-semibold text-[12.5px] whitespace-nowrap capitalize transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-brand-red border-brand-red text-white shadow-sm'
                    : 'bg-[#FAFAFA] border-brand-border text-brand-body hover:bg-brand-surface'
                }`}
              >
                {cat === 'all' ? '🍽️ All Items' : cat.replace('-', ' ')}
              </button>
            )
          })}
        </div>
      )}

      {/* Menu Grid */}
      <div className="px-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-brand-surface rounded-[16px] border border-brand-border">
            <p className="font-body text-[14px] text-brand-muted">No items match your selection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredItems.map(item => {
              const cartItem = cartItems.find(i => i.id === item.id)
              const quantity = cartItem ? cartItem.quantity : 0
              const imageUrl = item.imageUrl || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80`

              return (
                <div
                  key={item.id}
                  className="bg-white border border-brand-border rounded-[14px] overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200"
                >
                  <div className="relative h-44 w-full bg-brand-surface">
                    <Image
                      src={imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                    {item.isBestseller && (
                      <span className="absolute top-2.5 right-2.5 bg-brand-gold text-white font-brand font-semibold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                        <Flame size={10} /> Bestseller
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Dietary Indicators */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center ${
                          item.isVeg ? 'border-green-600' : 'border-red-600'
                        }`}>
                          <Circle size={6} className={item.isVeg ? 'fill-green-600 text-green-600' : 'fill-red-600 text-red-600'} />
                        </span>
                        <span className="text-[10px] font-brand font-bold text-brand-muted uppercase tracking-wider">
                          {item.categoryId.replace('-', ' ')}
                        </span>
                      </div>

                      <h3 className="font-brand font-bold text-[15.5px] text-brand-black leading-snug">
                        {item.name}
                      </h3>
                      <p className="font-body text-[12px] text-brand-muted mt-1 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-border">
                      <span className="font-brand font-extrabold text-[17px] text-brand-red">
                        ₹{item.price}
                      </span>
                      {quantity === 0 ? (
                        <button
                          onClick={() => addToCart({
                            id: item.id,
                            name: item.name,
                            description: item.description,
                            price: item.price,
                            category: item.categoryId,
                            dietaryTag: item.isVeg ? 'veg' : 'non-veg',
                            isBestseller: item.isBestseller,
                            imageKeyword: '',
                            image: item.imageUrl || undefined
                          })}
                          className="bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[11px] uppercase tracking-wider px-4 py-2 rounded-[8px] transition-all cursor-pointer shadow-xs"
                        >
                          + Add
                        </button>
                      ) : (
                        <div className="flex items-center border border-brand-red rounded-[8px] overflow-hidden bg-white shadow-xs">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center bg-brand-red text-white font-brand font-bold text-[13px] hover:bg-brand-redHover transition-all cursor-pointer"
                          >
                            −
                          </button>
                          <span className="font-brand font-bold text-[13px] text-brand-black min-w-[24px] text-center">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center bg-brand-red text-white font-brand font-bold text-[13px] hover:bg-brand-redHover transition-all cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
