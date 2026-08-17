'use client'

import React, { useEffect, useState } from 'react'
import AdminAuthGuard from '@/components/admin/layout/AdminAuthGuard'
import { useInventoryStore, DailyStockSummary } from '@/store/inventoryStore'
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, FileText, Loader2 } from 'lucide-react'

import InventoryHeader from '@/components/admin/inventory/InventoryHeader'

export default function ReportsPage() {
  return (
    <AdminAuthGuard>
      <ReportsContent />
    </AdminAuthGuard>
  )
}

function ReportsContent() {
  const fetchIngredients = useInventoryStore(state => state.fetchIngredients)
  const ingredients = useInventoryStore(state => state.ingredients)
  
  const fetchSummaries = useInventoryStore(state => state.fetchStockSummaries)
  const summaries = useInventoryStore(state => state.stockSummaries)
  const isInventoryLoading = useInventoryStore(state => state.isLoading)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchIngredients()
    fetchSummaries()
  }, [fetchIngredients, fetchSummaries])

  // Group summary records by date
  const groupedSummaries = summaries.reduce((acc, s) => {
    const list = acc[s.date] || []
    list.push(s)
    acc[s.date] = list
    return acc
  }, {} as Record<string, DailyStockSummary[]>)

  const sortedDates = Object.keys(groupedSummaries).sort((a, b) => b.localeCompare(a))

  // Set default selected date
  useEffect(() => {
    if (sortedDates.length > 0 && !selectedDate) {
      setSelectedDate(sortedDates[0])
    }
  }, [sortedDates, selectedDate])

  const selectedRows = selectedDate ? groupedSummaries[selectedDate] : []

  // Check if date has critical discrepancies
  const getDateStatus = (dateRows: DailyStockSummary[]) => {
    if (dateRows.some(r => r.status === 'critical')) return 'critical'
    if (dateRows.some(r => r.status === 'warning')) return 'warning'
    return 'ok'
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Dynamic Inventory Layout Subbar Header */}
      <InventoryHeader
        title="Reconciliation Logs"
        description="Review historical daily stock summaries, physical counts audit sheets, and unexplained shrinkage."
      />

      {isInventoryLoading && sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-muted space-y-2">
          <Loader2 className="animate-spin text-brand-red" size={32} />
          <p className="font-body text-[13px]">Retrieving logs...</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-16 bg-white border border-brand-border rounded-card text-brand-muted font-body text-[13px]">
          No reports available. Submit closing counts on the KDS panel to populate log entries.
        </div>
      ) : (
        /* Left Pane (Date List) | Right Pane (Details) Split */
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 items-start">
          {/* Left Pane - Dates */}
          <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4">
            <h2 className="font-brand font-bold text-[16px] text-brand-black flex items-center gap-2">
              <FileText size={18} className="text-brand-red" />
              Reconciliation Dates
            </h2>
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
              {sortedDates.map(date => {
                const dateRows = groupedSummaries[date]
                const status = getDateStatus(dateRows)
                const isSelected = selectedDate === date

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`w-full p-4 rounded-btn border text-left flex justify-between items-center transition-all ${
                      isSelected
                        ? 'border-brand-red bg-brand-redLight'
                        : 'border-brand-border hover:border-brand-red/40 bg-brand-surface'
                    }`}
                  >
                    <div>
                      <p className={`font-brand font-semibold text-[14px] ${isSelected ? 'text-brand-red' : 'text-brand-black'}`}>
                        {date}
                      </p>
                      <p className="font-body text-[12px] text-brand-muted mt-0.5">
                        {dateRows.length} ingredients logged
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        status === 'critical'
                          ? 'bg-brand-red animate-pulse'
                          : status === 'warning'
                          ? 'bg-brand-gold'
                          : 'bg-green-600'
                      }`} />
                      <ChevronRight size={16} className="text-brand-muted" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Pane - Selected Date Details */}
          <div className="bg-white border border-brand-border rounded-card p-5 shadow-xs space-y-4 min-h-[400px]">
            {selectedDate ? (
              <div className="space-y-6">
                <div>
                  <h2 className="font-brand font-bold text-[18px] text-brand-black">
                    Summary Log for {selectedDate}
                  </h2>
                  <p className="font-body text-[12px] text-brand-muted mt-0.5">
                    Detailed analysis of theoretical vs actual stock consumption.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-body text-[13px]">
                    <thead>
                      <tr className="border-b border-brand-border text-brand-muted">
                        <th className="py-2.5">Ingredient</th>
                        <th className="py-2.5 text-right">Available</th>
                        <th className="py-2.5 text-right">Theoretical</th>
                        <th className="py-2.5 text-right">Actual Used</th>
                        <th className="py-2.5 text-right">Discrepancy</th>
                        <th className="py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map(row => {
                        const ing = ingredients.find(i => i.id === row.ingredientId)
                        const isBad = Math.abs(row.discrepancy) > 0.001
                        
                        return (
                          <tr key={row.id} className="border-b border-brand-border hover:bg-brand-surface">
                            <td className="py-3 font-semibold text-brand-black">{ing?.name}</td>
                            <td className="py-3 text-right font-mono text-brand-muted">{(row.openingQty + row.inwardQty).toFixed(2)}</td>
                            <td className="py-3 text-right font-mono text-brand-muted">{row.theoreticalConsumed.toFixed(2)}</td>
                            <td className="py-3 text-right font-mono text-brand-black">{row.actualConsumed.toFixed(2)}</td>
                            <td className={`py-3 text-right font-mono font-semibold ${
                              row.discrepancy > 0 ? 'text-brand-red' : row.discrepancy < 0 ? 'text-green-700' : 'text-brand-muted'
                            }`}>
                              {row.discrepancy > 0 ? `+${row.discrepancy.toFixed(2)}` : row.discrepancy.toFixed(2)}
                            </td>
                            <td className="py-3 text-right">
                              <span className={`text-[10px] font-brand font-bold uppercase px-2 py-0.5 rounded-[4px] ${
                                row.status === 'critical'
                                  ? 'bg-red-100 text-brand-red'
                                  : row.status === 'warning'
                                  ? 'bg-yellow-100 text-brand-gold'
                                  : 'bg-green-100 text-brand-green'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 text-brand-muted space-y-2">
                <AlertCircle size={32} className="text-brand-border" />
                <p className="font-brand font-semibold">No Date Selected</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
