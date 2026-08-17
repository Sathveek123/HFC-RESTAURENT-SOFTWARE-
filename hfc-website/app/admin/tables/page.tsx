'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  LayoutGrid, Plus, Trash2, CheckCircle2, AlertCircle, X,
  Clock, Receipt, Download, ExternalLink, RefreshCw, Printer, ShieldAlert
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'

interface TableInfo {
  id: string
  table_number: string
  table_name: string | null
  capacity: number
  is_active: boolean
  qr_code_url: string | null
}

interface ActiveSession {
  id: string
  table_id: string | null
  table_number: string
  status: 'active' | 'payment_pending' | 'completed' | 'released'
  started_at: string
  total_amount: number
  payment_method?: string | null
  payment_status: 'paid' | 'unpaid'
  notes: string | null
}

interface KOTRound {
  id: string
  session_id: string
  table_number: string
  round_number: number
  items: { id: string; name: string; price: number; quantity: number }[]
  subtotal: number
  gst: number
  total: number
  status: 'placed' | 'accepted' | 'ready' | 'served' | 'rejected'
  placed_at: string
  kot_number: string
}

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [rounds, setRounds] = useState<KOTRound[]>([])
  const [loading, setLoading] = useState(true)

  // Selected table for detailed session panel
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  
  // Add Table Form state
  const [newTableNumber, setNewTableNumber] = useState('')
  const [newTableName, setNewTableName] = useState('')
  const [newCapacity, setNewCapacity] = useState(4)
  const [newIsActive, setNewIsActive] = useState(true)

  // QR Tent configuration state
  const [qrPrintTable, setQrPrintTable] = useState<TableInfo | null>(null)

  // Timer reference for elapsed times refresh
  const [timeTicker, setTimeTicker] = useState(0)
  const [origin, setOrigin] = useState('https://hfc-restaurent-software.vercel.app')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(prev => prev + 1)
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  // Audio chimer helper
  const playAlertChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch (_) {}
  }

  // 1. Initial Load of Tables, Sessions, and Rounds
  const loadData = async () => {
    setLoading(true)
    try {
      const { data: tbls } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number', { ascending: true })

      const { data: sss } = await supabase
        .from('table_sessions')
        .select('*')
        .in('status', ['active', 'payment_pending'])

      const { data: rnds } = await supabase
        .from('table_orders')
        .select('*')
        .order('placed_at', { ascending: true })

      if (tbls) setTables(tbls)
      if (sss) setSessions(sss)
      if (rnds) setRounds(rnds)
    } catch (e) {
      toast.error('Failed to load table data')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    // 2. Real-time updates subscription
    const tablesChannel = supabase
      .channel('admin-tables-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, (payload) => {
        // Trigger alert sound if payment notification arrives
        if (payload.new && (payload.new as any).notes === 'PAID_NOTIFIED') {
          playAlertChime()
          toast(
            `💰 Table ${(payload.new as any).table_number} requested cash/UPI payment verification!`,
            { icon: '🔔', duration: 6000 }
          )
        }
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_orders' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(tablesChannel)
    }
  }, [])

  // 3. Status determination helper
  const getTableStatus = (table: TableInfo) => {
    if (!table.is_active) return 'inactive'
    const session = sessions.find(s => s.table_number === table.table_number)
    if (!session) return 'free'
    return session.status // 'active' or 'payment_pending'
  }

  // 4. Selections
  const activeSessionForSelected = useMemo(() => {
    if (!selectedTable) return null
    return sessions.find(s => s.table_number === selectedTable.table_number) || null
  }, [selectedTable, sessions])

  const roundsForSelected = useMemo(() => {
    const session = activeSessionForSelected
    if (!session) return []
    return rounds.filter(r => r.session_id === session.id).sort((a, b) => b.round_number - a.round_number)
  }, [activeSessionForSelected, rounds])

  // 5. Actions: Add New Table
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTableNumber) return

    try {
      const id = `tbl-${newTableNumber}`
      const { error } = await supabase
        .from('restaurant_tables')
        .insert({
          id,
          table_number: newTableNumber,
          table_name: newTableName || `Table ${newTableNumber}`,
          capacity: newCapacity,
          is_active: newIsActive
        })

      if (error) {
        toast.error('Error adding table: ' + error.message)
      } else {
        toast.success(`Table ${newTableNumber} created successfully!`)
        setIsAddModalOpen(false)
        setNewTableNumber('')
        setNewTableName('')
      }
    } catch (e) {
      toast.error('Failed to save table')
    }
  }

  // 6. Actions: Delete Table
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table? This will clear its configuration.')) return

    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .delete()
        .eq('id', tableId)

      if (error) {
        toast.error('Failed to delete: ' + error.message)
      } else {
        toast.success('Table deleted successfully')
        setSelectedTable(null)
      }
    } catch (e) {
      toast.error('Deletion error')
    }
  }

  // 7. Actions: Update KOT status (placed -> accepted -> ready -> served)
  const handleUpdateRoundStatus = async (roundId: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from('table_orders')
        .update({
          status: nextStatus,
          served_at: nextStatus === 'served' ? new Date().toISOString() : null
        })
        .eq('id', roundId)

      if (error) {
        toast.error('Failed to update status: ' + error.message)
      } else {
        toast.success(`KOT updated to ${nextStatus}`)
      }
    } catch (e) {
      toast.error('Error updating status')
    }
  }

  // 8. Actions: Release Table (Pay & Complete, or Force Release)
  const handleReleaseTable = async (isForce: boolean) => {
    const session = activeSessionForSelected
    if (!session) return

    const confirmMsg = isForce
      ? 'WARNING: This will clear the table lock directly without writing to bill histories. Use only for abandoned sessions. Proceed?'
      : `Confirm payment and release Table ${session.table_number}? This will compile all rounds into a finalized invoice.`

    if (!confirm(confirmMsg)) return

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token

      if (!token) {
        toast.error('Admin Auth Token missing. Try signing out and back in.')
        return
      }

      const res = await fetch('/api/table/release-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: session.id,
          tableNumber: session.table_number,
          paymentMethod: isForce ? null : (session.payment_method || 'UPI'),
          isForceRelease: isForce
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Table ${session.table_number} released! Ready for next guests.`)
        setSelectedTable(null)
      } else {
        toast.error(data.error || 'Failed to release table')
      }
    } catch (e) {
      toast.error('Connection error releasing table')
    }
  }

  // Helper: print elements for Table QR tent cards
  const printTentCard = (table: TableInfo) => {
    setQrPrintTable(table)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  // Computed layout calculations
  const tableCounts = useMemo(() => {
    return {
      total: tables.length,
      free: tables.filter(t => getTableStatus(t) === 'free').length,
      active: tables.filter(t => getTableStatus(t) === 'active').length,
      pending: tables.filter(t => getTableStatus(t) === 'payment_pending').length,
      inactive: tables.filter(t => !t.is_active).length,
    }
  }, [tables, sessions])

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-[16px] border border-brand-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-redLight rounded-[12px] text-brand-red">
            <LayoutGrid size={24} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[22px] text-brand-black tracking-tight">
              Table Management
            </h1>
            <p className="font-body text-[12.5px] text-brand-muted mt-0.5">
              Live floor grid status and table order session overrides
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-brand-red hover:bg-brand-redHover text-white font-brand font-bold text-[13px] uppercase tracking-wider px-4 py-2.5 rounded-btn transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-brand-redLight/10"
          >
            <Plus size={16} /> Add Table
          </button>
          
          <button
            onClick={loadData}
            className="bg-white border border-brand-border hover:bg-brand-surface text-brand-body font-brand font-bold text-[13px] uppercase tracking-wider px-4 py-2.5 rounded-btn transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. Quick Status Banner KPI widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-[14px] border border-brand-border shadow-xs text-center">
          <span className="text-[11px] font-brand font-bold text-brand-muted uppercase tracking-wider">Total Tables</span>
          <span className="block font-brand font-black text-[24px] text-brand-black mt-1">{tableCounts.total}</span>
        </div>
        <div className="bg-white p-4 rounded-[14px] border border-brand-border shadow-xs text-center border-l-4 border-l-green-500">
          <span className="text-[11px] font-brand font-bold text-brand-muted uppercase tracking-wider text-green-600">🟢 Free Tables</span>
          <span className="block font-brand font-black text-[24px] text-green-600 mt-1">{tableCounts.free}</span>
        </div>
        <div className="bg-white p-4 rounded-[14px] border border-brand-border shadow-xs text-center border-l-4 border-l-red-500">
          <span className="text-[11px] font-brand font-bold text-brand-muted uppercase tracking-wider text-brand-red">🔴 Active Orders</span>
          <span className="block font-brand font-black text-[24px] text-brand-red mt-1">{tableCounts.active}</span>
        </div>
        <div className="bg-white p-4 rounded-[14px] border border-brand-border shadow-xs text-center border-l-4 border-l-amber-500">
          <span className="text-[11px] font-brand font-bold text-brand-muted uppercase tracking-wider text-amber-500">🟡 Paying / Pending</span>
          <span className="block font-brand font-black text-[24px] text-amber-500 mt-1">{tableCounts.pending}</span>
        </div>
      </div>

      {/* 3. Core Grid & Override detail panel layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Interactive visual floor grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full">
          {tables.map(table => {
            const status = getTableStatus(table)
            const isActive = selectedTable?.id === table.id
            const session = sessions.find(s => s.table_number === table.table_number)

            // Select colors based on table status
            let borderClass = 'border-brand-border'
            let bgBadge = 'bg-gray-100 text-gray-700'
            let statusText = 'Dine-in'

            if (status === 'free') {
              borderClass = 'border-green-300 hover:border-green-500 hover:shadow-green-50/50 hover:shadow-lg'
              bgBadge = 'bg-green-50 text-green-700'
              statusText = '🟢 Free'
            } else if (status === 'active') {
              borderClass = 'border-red-300 bg-red-50/10 hover:border-red-500 hover:shadow-red-50/50 hover:shadow-lg'
              bgBadge = 'bg-red-50 text-brand-red'
              statusText = '🔴 Active'
            } else if (status === 'payment_pending') {
              borderClass = 'border-amber-300 bg-amber-50/10 hover:border-amber-500 hover:shadow-amber-50/50 hover:shadow-lg'
              bgBadge = 'bg-amber-50 text-amber-700'
              statusText = '🟡 Pay Request'
            } else if (status === 'inactive') {
              borderClass = 'border-gray-200 opacity-50 bg-gray-50'
              bgBadge = 'bg-gray-200 text-gray-500'
              statusText = 'Inactive'
            }

            return (
              <div
                key={table.id}
                onClick={() => table.is_active && setSelectedTable(table)}
                className={`bg-white border rounded-[16px] p-4 flex flex-col justify-between h-40 cursor-pointer transition-all duration-200 shadow-xs ${borderClass} ${
                  isActive ? 'ring-2 ring-brand-black border-transparent scale-102 shadow-md' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-brand font-black text-[16px] text-brand-black">
                      Table {table.table_number}
                    </span>
                    <span className={`text-[10px] font-brand font-bold px-2 py-0.5 rounded-full ${bgBadge}`}>
                      {statusText}
                    </span>
                  </div>
                  <span className="text-[11.5px] font-body text-brand-muted mt-1 block">
                    {table.table_name || `Seating: ${table.capacity}`} · {table.capacity} seats
                  </span>
                </div>

                {/* Session total details if locked */}
                {session && (status === 'active' || status === 'payment_pending') && (
                  <div className="mt-auto border-t border-brand-border pt-2 flex items-center justify-between">
                    <span className="font-brand font-extrabold text-[15px] text-brand-red">
                      ₹{(Number(session.total_amount) || 0).toFixed(0)}
                    </span>
                    
                    {session.notes === 'PAID_NOTIFIED' && (
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" title="Customer requested checkout" />
                    )}
                  </div>
                )}

                {!session && table.is_active && (
                  <div className="mt-auto flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        printTentCard(table)
                      }}
                      className="p-1.5 text-brand-muted hover:text-brand-black transition-colors rounded-[8px] bg-brand-surface border border-brand-border hover:shadow-xs"
                      title="Print A5 Table Tent Card"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: Selected table session details override panel */}
        {selectedTable && (
          <div className="w-full lg:w-[420px] bg-white border border-brand-border rounded-[20px] shadow-sm overflow-hidden animate-fade-in flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-brand-border flex items-center justify-between bg-brand-surface">
              <div>
                <h3 className="font-display font-bold text-[17.5px] text-brand-black">
                  Table {selectedTable.table_number} Controls
                </h3>
                <p className="text-[12px] font-body text-brand-muted">
                  {selectedTable.table_name || 'Physical table session'}
                </p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-1.5 text-brand-muted hover:text-brand-black transition-colors rounded-full hover:bg-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Session Actions Body */}
            {activeSessionForSelected ? (
              <div className="p-5 space-y-5">
                {/* Active Session details */}
                <div className="bg-[#FAFDFB] border border-green-200/50 p-4 rounded-[12px] flex items-center justify-between">
                  <div>
                    <span className="text-[11.5px] font-brand font-bold text-green-700 uppercase tracking-wider">Active Session</span>
                    <span className="block font-mono text-[10.5px] text-brand-muted mt-0.5">ID: {activeSessionForSelected.id}</span>
                  </div>
                  
                  {activeSessionForSelected.notes === 'PAID_NOTIFIED' && (
                    <span className="bg-amber-100 border border-amber-300 text-amber-800 font-brand font-bold text-[10px] px-2.5 py-1 rounded-full animate-pulse">
                      🔔 Paid Notified
                    </span>
                  )}
                </div>

                {/* KOT Rounds */}
                <div className="space-y-3">
                  <span className="font-brand font-bold text-[11.5px] text-brand-muted uppercase tracking-wider block">KOT Rounds List</span>
                  {roundsForSelected.length === 0 ? (
                    <p className="text-[12.5px] font-body text-brand-muted text-center py-4">No KOTs sent for this session.</p>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {roundsForSelected.map(round => (
                        <div key={round.id} className="border border-brand-border rounded-[10px] p-3 space-y-2.5">
                          <div className="flex justify-between items-center text-[12px]">
                            <span className="font-brand font-bold text-brand-black">Round {round.round_number} ({round.kot_number})</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-brand font-bold uppercase ${
                              round.status === 'served'
                                ? 'bg-green-50 text-green-700'
                                : round.status === 'ready'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-blue-50 text-blue-600'
                            }`}>
                              {round.status}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {round.items.map((it, i) => (
                              <div key={i} className="flex justify-between text-[12.5px] font-body">
                                <span>{it.quantity}x {it.name}</span>
                                <span className="font-semibold text-brand-muted">₹{(it.price * it.quantity).toFixed(0)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Round status actions */}
                          {round.status !== 'served' && round.status !== 'rejected' && (
                            <div className="flex gap-2 pt-2 border-t border-brand-border">
                              {round.status === 'placed' && (
                                <button
                                  onClick={() => handleUpdateRoundStatus(round.id, 'accepted')}
                                  className="flex-1 text-[11px] font-brand font-bold bg-blue-50 border border-blue-200 text-blue-600 py-1.5 rounded-[6px] hover:bg-blue-100 cursor-pointer"
                                >
                                  Accept
                                </button>
                              )}
                              {(round.status === 'placed' || round.status === 'accepted') && (
                                <button
                                  onClick={() => handleUpdateRoundStatus(round.id, 'ready')}
                                  className="flex-1 text-[11px] font-brand font-bold bg-amber-50 border border-amber-200 text-amber-600 py-1.5 rounded-[6px] hover:bg-amber-100 cursor-pointer"
                                >
                                  Mark Ready
                                </button>
                              )}
                              {round.status === 'ready' && (
                                <button
                                  onClick={() => handleUpdateRoundStatus(round.id, 'served')}
                                  className="flex-1 text-[11px] font-brand font-bold bg-green-50 border border-green-200 text-green-600 py-1.5 rounded-[6px] hover:bg-green-100 cursor-pointer"
                                >
                                  Mark Served
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invoice calculations summary */}
                <div className="border-t border-brand-border pt-4 space-y-2">
                  <div className="flex justify-between text-[13px] text-brand-muted">
                    <span>Session Running Total</span>
                    <span className="font-brand font-extrabold text-[15px] text-brand-red">
                      ₹{Number(activeSessionForSelected.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Final release actions */}
                <div className="space-y-2 pt-4 border-t border-brand-border">
                  <button
                    onClick={() => handleReleaseTable(false)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-brand font-bold text-[12.5px] uppercase tracking-wider py-3.5 rounded-btn transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={15} /> Confirm Payment & Release
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReleaseTable(true)}
                      className="flex-1 border border-brand-red text-brand-red hover:bg-brand-redLight font-brand font-bold text-[11px] uppercase tracking-wider py-2.5 rounded-btn transition-all cursor-pointer flex items-center justify-center gap-1"
                      title="Clear session lock directly without logging a bill"
                    >
                      <Trash2 size={13} /> Force Release
                    </button>

                    <button
                      onClick={() => printTentCard(selectedTable)}
                      className="border border-brand-border hover:bg-brand-surface text-brand-body font-brand font-bold text-[11px] uppercase tracking-wider px-3.5 py-2.5 rounded-btn transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Printer size={13} /> Tent
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 className="font-brand font-bold text-[14.5px] text-brand-black">Table is Free</h4>
                  <p className="font-body text-[12px] text-brand-muted mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                    No active ordering sessions. Scans pointing to this table will lock it to a new session automatically.
                  </p>
                </div>

                <div className="flex gap-2 pt-4 border-t border-brand-border">
                  <button
                    onClick={() => printTentCard(selectedTable)}
                    className="flex-1 bg-brand-black hover:bg-brand-red text-white font-brand font-bold text-[12px] uppercase tracking-wider py-3 rounded-btn transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Printer size={14} /> Print QR Tent
                  </button>
                  
                  <button
                    onClick={() => handleDeleteTable(selectedTable.id)}
                    className="border border-red-200 text-brand-red hover:bg-red-50 p-3 rounded-btn transition-colors cursor-pointer"
                    title="Remove this physical table"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Add Table Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[16px] border border-brand-border shadow-xl w-full max-w-[420px] p-6 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-brand-border">
              <h3 className="font-display font-bold text-[17px] text-brand-black flex items-center gap-2">
                🍽️ Configure New Table
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-brand-muted hover:text-brand-black transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11.5px] font-brand font-bold text-brand-black uppercase tracking-wider mb-1.5">
                  Table Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.g., 05, 12, 20"
                  value={newTableNumber}
                  onChange={e => setNewTableNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full p-2.5 border border-brand-border rounded-btn focus:outline-brand-red bg-brand-surface text-[13.5px] font-body"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-brand font-bold text-brand-black uppercase tracking-wider mb-1.5">
                  Table Description / Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="E.g., Window Booth A, Private Room"
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  className="w-full p-2.5 border border-brand-border rounded-btn focus:outline-brand-red bg-brand-surface text-[13.5px] font-body"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-brand font-bold text-brand-black uppercase tracking-wider mb-1.5">
                  Seating Capacity
                </label>
                <select
                  value={newCapacity}
                  onChange={e => setNewCapacity(Number(e.target.value))}
                  className="w-full p-2.5 border border-brand-border rounded-btn focus:outline-brand-red bg-brand-surface text-[13.5px] font-body"
                >
                  <option value={2}>2 Persons</option>
                  <option value={4}>4 Persons</option>
                  <option value={6}>6 Persons</option>
                  <option value={8}>8 Persons</option>
                  <option value={12}>12 Persons</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="newIsActive"
                  checked={newIsActive}
                  onChange={e => setNewIsActive(e.target.checked)}
                  className="w-4 h-4 text-brand-red focus:ring-brand-red border-brand-border rounded"
                />
                <label htmlFor="newIsActive" className="text-[13px] font-body font-semibold text-brand-black select-none">
                  Available for Dine-in
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-brand-border rounded-btn font-brand font-semibold text-[13px] text-brand-body hover:bg-brand-surface cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-red hover:bg-brand-redHover text-white rounded-btn font-brand font-bold text-[13px] cursor-pointer text-center"
                >
                  Create Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. A5 Printable QR tent helper overlay (Visible ONLY during window.print()) */}
      {qrPrintTable && (
        <div className="print-tent-card-screen hidden print:flex fixed inset-0 z-[9999] bg-white flex-col items-center justify-between p-12 text-center">
          {/* Top Header Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 relative rounded-full overflow-hidden border-2 border-brand-red">
              <img src="/logo.jpeg" className="w-full h-full object-cover" alt="HFC Logo" />
            </div>
            <h1 className="font-brand font-black text-[36px] text-brand-red leading-none tracking-tight">HFC RESTAURANT</h1>
            <p className="font-body text-[14px] text-brand-muted tracking-[2px] uppercase">Smart contactless table ordering</p>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center p-8 border-4 border-brand-red rounded-[24px] bg-white shadow-md max-w-sm">
            <QRCodeSVG value={`${origin}/table/${qrPrintTable.table_number}`} size={260} level="H" />
            
            <div className="mt-6 bg-brand-red text-white font-brand font-black text-[24px] px-8 py-2 rounded-full">
              TABLE {qrPrintTable.table_number}
            </div>
          </div>

          {/* Bottom Callouts */}
          <div className="space-y-3">
            <h2 className="font-display font-bold text-[22px] text-brand-black">SCAN TO ORDER</h2>
            <p className="font-body text-[13.5px] text-brand-muted max-w-[320px] mx-auto">
              Scan this QR code with your smartphone camera to browse the menu, place orders, and pay instantly!
            </p>
            <p className="font-brand font-bold text-[12px] text-brand-red uppercase tracking-wider pt-4 border-t border-brand-border">
              🍽️ No waiter needed · fast & contactless
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
