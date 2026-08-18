'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Edit2, ShieldAlert, Check, X, ToggleLeft, ToggleRight, Loader2, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface WaiterStaff {
  id: string
  name: string
  is_active: boolean
  assigned_tables: string[] | null
  created_at: string
}

const inputCls = 'w-full h-11 border border-brand-border rounded-[8px] px-4 font-body text-[13.5px] text-brand-black focus:border-brand-red focus:outline-none transition-all bg-white'

export default function AdminWaitersPage() {
  const [waiters, setWaiters] = useState<WaiterStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Add form state
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [assignedTablesStr, setAssignedTablesStr] = useState('')

  // Edit modal state
  const [editingWaiter, setEditingWaiter] = useState<WaiterStaff | null>(null)
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')
  const [editTablesStr, setEditTablesStr] = useState('')

  const fetchWaiters = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('waiters')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWaiters(data || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to load waiters list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWaiters()
  }, [])

  const handleAddWaiter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !pin.trim()) {
      toast.error('Name and PIN are required')
      return
    }

    if (pin.trim().length !== 4 || isNaN(Number(pin))) {
      toast.error('PIN must be a 4-digit number')
      return
    }

    setActionLoading('add')

    // Parse tables
    const tables = assignedTablesStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    const staffId = `WT-${Date.now().toString(36).toUpperCase()}`

    try {
      // 1. Insert waiter profile
      const { error: waiterErr } = await supabase.from('waiters').insert({
        id: staffId,
        name: name.trim(),
        is_active: true,
        assigned_tables: tables.length > 0 ? tables : null
      })

      if (waiterErr) throw waiterErr

      // 2. Insert waiter credentials
      const { error: credErr } = await supabase.from('waiter_credentials').insert({
        staff_id: staffId,
        pin: pin.trim()
      })

      if (credErr) {
        // Rollback waiter insert if credentials fail
        await supabase.from('waiters').delete().eq('id', staffId)
        throw credErr
      }

      toast.success('Waiter staff added successfully!')
      setName('')
      setPin('')
      setAssignedTablesStr('')
      fetchWaiters()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add waiter')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (waiter: WaiterStaff) => {
    setActionLoading(`toggle-${waiter.id}`)
    try {
      const { error } = await supabase
        .from('waiters')
        .update({ is_active: !waiter.is_active })
        .eq('id', waiter.id)

      if (error) throw error
      toast.success(`${waiter.name} is now ${!waiter.is_active ? 'Active' : 'Inactive'}`)
      fetchWaiters()
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteWaiter = async (id: string) => {
    if (!confirm('Are you sure you want to delete this waiter? This will remove their credentials and history association.')) return
    setActionLoading(`delete-${id}`)
    try {
      const { error } = await supabase
        .from('waiters')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Waiter deleted successfully.')
      fetchWaiters()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete waiter')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenEditModal = (waiter: WaiterStaff) => {
    setEditingWaiter(waiter)
    setEditName(waiter.name)
    setEditPin('')
    setEditTablesStr(waiter.assigned_tables ? waiter.assigned_tables.join(', ') : '')
  }

  const handleSaveEdit = async () => {
    if (!editingWaiter) return
    if (!editName.trim()) {
      toast.error('Name is required')
      return
    }

    if (editPin.trim().length > 0 && (editPin.trim().length !== 4 || isNaN(Number(editPin)))) {
      toast.error('PIN must be a 4-digit number')
      return
    }

    setActionLoading(`edit-${editingWaiter.id}`)

    const tables = editTablesStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    try {
      // 1. Update waiter profile
      const { error: waiterErr } = await supabase
        .from('waiters')
        .update({
          name: editName.trim(),
          assigned_tables: tables.length > 0 ? tables : null
        })
        .eq('id', editingWaiter.id)

      if (waiterErr) throw waiterErr

      // 2. Update credentials if PIN was modified
      if (editPin.trim()) {
        const { error: credErr } = await supabase
          .from('waiter_credentials')
          .upsert({
            staff_id: editingWaiter.id,
            pin: editPin.trim()
          })

        if (credErr) throw credErr
      }

      toast.success('Waiter profile updated successfully!')
      setEditingWaiter(null)
      fetchWaiters()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update waiter')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-5">
        <div>
          <h1 className="font-brand font-black text-[28px] text-brand-black leading-tight flex items-center gap-2">
            <Users className="text-brand-red" size={28} />
            Waiter Staff Management
          </h1>
          <p className="font-body text-[13px] text-brand-body mt-1">
            Configure waiter credentials, PIN security, and assign dining section table zones.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Add Waiter Form */}
        <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-xs lg:col-span-1 space-y-4">
          <h2 className="font-brand font-bold text-[16px] text-brand-black border-b border-brand-border pb-3">
            Add Waiter Staff
          </h2>

          <form onSubmit={handleAddWaiter} className="space-y-4">
            <div>
              <label className="block text-[11px] font-brand font-semibold text-brand-muted uppercase tracking-[0.5px] mb-1.5">
                Full Name *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-[11px] font-brand font-semibold text-brand-muted uppercase tracking-[0.5px] mb-1.5">
                4-Digit PIN *
              </label>
              <input
                required
                type="password"
                maxLength={4}
                placeholder="e.g. 2026"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full h-11 border border-brand-border rounded-[8px] px-4 font-mono font-bold text-[18px] text-center tracking-widest outline-none focus:border-brand-red transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-brand font-semibold text-brand-muted uppercase tracking-[0.5px] mb-1.5 flex justify-between">
                <span>Assigned Tables</span>
                <span className="text-[10px] text-brand-muted normal-case font-normal">Blank = Sees all tables</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 01, 02, 05"
                value={assignedTablesStr}
                onChange={e => setAssignedTablesStr(e.target.value)}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading === 'add'}
              className="w-full h-11 bg-brand-black text-white hover:bg-brand-red font-brand font-semibold text-[13px] uppercase rounded-btn flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              {actionLoading === 'add' ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  <Plus size={16} /> Add Waiter
                </>
              )}
            </button>
          </form>
        </div>

        {/* Waiters List */}
        <div className="bg-white border border-brand-border rounded-[12px] p-5 shadow-xs lg:col-span-2 space-y-4">
          <h2 className="font-brand font-bold text-[16px] text-brand-black border-b border-brand-border pb-3">
            Active Waiters Directory
          </h2>

          {loading ? (
            <div className="flex flex-col items-center py-20 text-brand-muted space-y-2">
              <Loader2 className="animate-spin text-brand-red" size={28} />
              <p className="font-body text-[13px]">Loading waiter staff directory...</p>
            </div>
          ) : waiters.length === 0 ? (
            <div className="text-center py-16 text-brand-muted font-body text-[13px]">
              No waiter staff profiles registered. Use the form on the left to add your first waiter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-body text-[13px] min-w-[500px]">
                <thead>
                  <tr className="border-b border-brand-border text-[11px] font-brand font-semibold uppercase text-brand-muted">
                    <th className="py-2.5">Name</th>
                    <th className="py-2.5">Tables</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {waiters.map(waiter => (
                    <tr key={waiter.id} className="hover:bg-brand-surface/30">
                      <td className="py-3 font-semibold text-brand-black">
                        {waiter.name}
                        <span className="block font-mono text-[9px] text-brand-muted font-normal mt-0.5">{waiter.id}</span>
                      </td>
                      <td className="py-3">
                        {waiter.assigned_tables && waiter.assigned_tables.length > 0 ? (
                          <span className="bg-blue-50 text-blue-800 border border-blue-100 rounded-full px-2 py-0.5 text-[11px] font-medium font-brand">
                            {waiter.assigned_tables.join(', ')}
                          </span>
                        ) : (
                          <span className="text-brand-muted italic">All Tables (Floor Cover)</span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          disabled={!!actionLoading}
                          onClick={() => handleToggleActive(waiter)}
                          className="text-brand-muted hover:text-brand-black transition-colors cursor-pointer"
                        >
                          {waiter.is_active ? (
                            <span className="flex items-center gap-1 text-green-700 font-semibold text-[12px]">
                              <Check size={14} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-brand-red font-semibold text-[12px]">
                              <X size={14} /> Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(waiter)}
                          className="p-1 text-brand-muted hover:text-brand-black transition-colors cursor-pointer inline-block"
                          title="Edit Profile"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteWaiter(waiter.id)}
                          className="p-1 text-brand-muted hover:text-brand-red transition-colors cursor-pointer inline-block"
                          title="Delete Waiter"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Edit Modal overlay */}
      {editingWaiter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setEditingWaiter(null)}>
          <div className="bg-white rounded-[20px] p-6 max-w-sm w-full shadow-2xl border border-brand-border animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b border-brand-border pb-3">
              <h3 className="font-brand font-bold text-[18px] text-brand-black">Edit Waiter Staff</h3>
              <button onClick={() => setEditingWaiter(null)} className="text-brand-muted hover:text-brand-black transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-brand font-semibold text-brand-muted uppercase tracking-[0.5px] mb-1.5">
                  Waiter Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[11px] font-brand font-semibold text-brand-muted uppercase tracking-[0.5px] mb-1.5">
                  Update PIN (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Keep current PIN"
                  value={editPin}
                  onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-11 border border-brand-border rounded-[8px] px-4 font-mono font-bold text-[18px] text-center tracking-widest outline-none focus:border-brand-red transition-all bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-brand font-semibold text-brand-muted uppercase tracking-[0.5px] mb-1.5 flex justify-between">
                  <span>Assigned Tables</span>
                  <span className="text-[10px] text-brand-muted normal-case font-normal">Blank = Sees all tables</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 01, 02"
                  value={editTablesStr}
                  onChange={e => setEditTablesStr(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingWaiter(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-brand-black font-brand font-bold text-[12px] rounded-btn uppercase tracking-[0.5px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={actionLoading === `edit-${editingWaiter.id}`}
                  className="flex-1 py-3 bg-brand-black hover:bg-brand-red text-white font-brand font-bold text-[12px] rounded-btn uppercase tracking-[0.5px] cursor-pointer flex items-center justify-center gap-1"
                >
                  {actionLoading === `edit-${editingWaiter.id}` ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
