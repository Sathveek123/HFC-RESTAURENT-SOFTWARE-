'use client'

import React, { useState, useRef, useMemo, useEffect } from 'react'
import {
  Truck, MessageCircle, Eye, EyeOff, Pencil, Trash2,
  AlertTriangle, X, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAgentsStore, Agent } from '@/store/agentsStore'
import { useOrderStore } from '@/store/orderStore'
import { fetchAgentsFromSupabase, subscribeToAgentsRealtime } from '@/lib/supabaseSync'

// ─── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const inputCls = 'w-full h-[44px] border border-brand-border rounded-[8px] px-4 font-body text-[14px] text-brand-black focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 transition-all bg-white'
const selectCls = `${inputCls} appearance-none cursor-pointer`

function FormLabel({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label className="font-brand font-semibold text-[11px] text-brand-muted uppercase tracking-[0.5px]">
        {children}
      </label>
      {extra}
    </div>
  )
}

// ─── EDIT MODAL ────────────────────────────────────────────────────────────────

interface EditModalProps { agent: Agent; onClose: () => void }

function EditModal({ agent, onClose }: EditModalProps) {
  const updateAgent = useAgentsStore(state => state.updateAgent)
  const isUsernameAvailable = useAgentsStore(state => state.isUsernameAvailable)

  const [name, setName] = useState(agent.name)
  const [whatsapp, setWhatsapp] = useState(agent.whatsapp)
  const [username, setUsername] = useState(agent.username)
  const [password, setPassword] = useState('')
  const [vehicleType, setVehicleType] = useState(agent.vehicleType ?? '')
  const [coverageArea, setCoverageArea] = useState(agent.coverageArea ?? '')
  const [showPwd, setShowPwd] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'ok' | 'taken' | 'short'>('ok')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkUsername = (val: string) => {
    if (val.length < 4) { setUsernameStatus('short'); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setUsernameStatus(isUsernameAvailable(val, agent.id) ? 'ok' : 'taken')
    }, 300)
  }

  const whatsappValid = /^\d{10,13}$/.test(whatsapp)
  const passwordValid = password.length === 0 || password.length >= 4
  const canSave =
    name.trim().length > 0 &&
    whatsappValid &&
    username.length >= 4 &&
    usernameStatus === 'ok' &&
    passwordValid

  const handleSave = () => {
    if (!canSave) return
    updateAgent(agent.id, {
      name: name.trim(),
      whatsapp,
      username,
      password: password || undefined,
      vehicleType: (vehicleType as Agent['vehicleType']) || null,
      coverageArea: coverageArea.trim() || null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-[14px] border border-brand-border shadow-xl w-full max-w-[540px] p-6" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-[18px] text-brand-black">Edit Agent</h3>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-black transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <FormLabel>Name</FormLabel>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Agent name" />
          </div>

          <div>
            <FormLabel>WhatsApp number</FormLabel>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              maxLength={13} className={`${inputCls} ${whatsapp && !whatsappValid ? 'border-red-400' : ''}`}
              placeholder="919876543210" />
          </div>

          <div>
            <FormLabel>Login username</FormLabel>
            <input value={username}
              onChange={e => { const v = e.target.value.toLowerCase().replace(/\s/g, ''); setUsername(v); checkUsername(v) }}
              className={`${inputCls} font-mono ${usernameStatus === 'taken' ? 'border-red-400' : ''}`}
              placeholder="min 4 chars" />
            {username.length > 0 && (
              <p className={`text-[11px] mt-1 font-semibold ${usernameStatus === 'ok' ? 'text-green-700' : 'text-brand-red'}`}>
                {usernameStatus === 'ok' ? '✓ Username available' : usernameStatus === 'taken' ? '✗ Username already taken' : '✗ Min 4 characters'}
              </p>
            )}
          </div>

          <div>
            <FormLabel>Login password</FormLabel>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                className={`${inputCls} pr-11`} placeholder="leave blank to keep unchanged" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-black transition-colors">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <FormLabel>Vehicle type</FormLabel>
            <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={selectCls}>
              <option value="">Not specified</option>
              <option value="bike">Bike</option>
              <option value="bicycle">Bicycle</option>
              <option value="scooter">Scooter</option>
              <option value="on-foot">On Foot</option>
            </select>
          </div>

          <div>
            <FormLabel>Coverage area</FormLabel>
            <input value={coverageArea} onChange={e => setCoverageArea(e.target.value)}
              className={inputCls} placeholder="e.g. Maruthi Nagar, Labour Colony" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-brand-border">
          <button onClick={onClose}
            className="h-[42px] px-5 font-brand font-semibold text-[12px] uppercase text-brand-muted hover:text-brand-black transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className={`h-[42px] px-6 font-brand font-bold text-[12px] uppercase tracking-[1px] rounded-[8px] transition-colors cursor-pointer ${
              canSave ? 'bg-brand-red hover:bg-brand-redHover text-white' : 'bg-gray-100 text-brand-muted cursor-not-allowed'
            }`}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AGENT ROW ────────────────────────────────────────────────────────────────

function AgentRow({
  agent, assignedCount, onEdit, showDelete, onDeleteClick, onDeleteConfirm, onDeleteCancel
}: {
  agent: Agent
  assignedCount: number
  onEdit: () => void
  showDelete: boolean
  onDeleteClick: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const toggleAgentActive = useAgentsStore(state => state.toggleAgentActive)

  const vehicleLabel: Record<string, string> = {
    bike: '🏍 Bike', bicycle: '🚲 Bicycle', scooter: '🛵 Scooter', 'on-foot': '🚶 On Foot'
  }

  return (
    <>
      <tr className="border-b border-brand-border last:border-0 hover:bg-[#FAFAFA] transition-colors">
        {/* Name */}
        <td className="px-5 py-4 align-middle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-redLight flex items-center justify-center flex-shrink-0">
              <span className="font-brand font-bold text-[11px] text-brand-red">{getInitials(agent.name)}</span>
            </div>
            <div>
              <span className="font-brand font-semibold text-[13px] text-brand-black block">{agent.name}</span>
              {agent.vehicleType && (
                <span className="font-body text-[11px] text-brand-muted">{vehicleLabel[agent.vehicleType] ?? agent.vehicleType}</span>
              )}
            </div>
          </div>
        </td>

        {/* WhatsApp */}
        <td className="px-5 py-4 align-middle">
          <div className="flex items-center gap-2">
            <a href={`tel:+${agent.whatsapp}`} onClick={e => e.stopPropagation()}
              className="font-body text-[13px] text-brand-black hover:text-brand-red transition-colors">
              +{agent.whatsapp}
            </a>
            <button onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${agent.whatsapp}`, '_blank') }}
              className="w-6 h-6 rounded-[4px] bg-[#25D366]/10 flex items-center justify-center hover:bg-[#25D366]/25 transition-colors cursor-pointer"
              title="Message on WhatsApp">
              <MessageCircle size={12} className="text-[#25D366]" />
            </button>
          </div>
          {agent.coverageArea && (
            <p className="font-body text-[11px] text-brand-muted mt-0.5">{agent.coverageArea}</p>
          )}
        </td>

        {/* Username */}
        <td className="px-5 py-4 align-middle">
          <span className="font-mono font-semibold text-[13px] text-brand-black bg-[#FAFAFA] border border-brand-border rounded-[5px] px-2.5 py-1">
            {agent.username}
          </span>
        </td>

        {/* Orders stat */}
        <td className="px-5 py-4 align-middle text-center">
          <span className="font-brand font-bold text-[13px] text-brand-black">{assignedCount}</span>
          <span className="font-body text-[11px] text-brand-muted block">active</span>
        </td>

        {/* Active toggle */}
        <td className="px-5 py-4 align-middle">
          <button
            onClick={e => { e.stopPropagation(); toggleAgentActive(agent.id); toast.success(`${agent.name} ${agent.isActive ? 'set off duty' : 'set active'}`) }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-brand font-bold text-[10px] uppercase tracking-[0.5px] transition-colors cursor-pointer ${
              agent.isActive
                ? 'bg-[#166534] text-white hover:bg-[#14532D]'
                : 'bg-[#F0F0F0] text-brand-muted hover:bg-[#E5E5E5]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${agent.isActive ? 'bg-white' : 'bg-brand-muted'}`} />
            {agent.isActive ? 'Active' : 'Off Duty'}
          </button>
        </td>

        {/* Actions */}
        <td className="px-5 py-4 align-middle">
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); onEdit() }}
              className="bg-white border border-brand-border text-brand-black font-brand font-semibold text-[11px] uppercase px-3 h-[30px] rounded-[6px] hover:border-brand-black hover:bg-[#F5F5F5] transition-all flex items-center gap-1.5 cursor-pointer">
              <Pencil size={11} /> Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDeleteClick() }}
              className="bg-white border border-red-300 text-red-600 font-brand font-semibold text-[11px] uppercase px-3 h-[30px] rounded-[6px] hover:bg-red-50 transition-all flex items-center gap-1.5 cursor-pointer">
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </td>
      </tr>

      {/* Inline delete confirm row */}
      {showDelete && (
        <tr>
          <td colSpan={6} className="bg-red-50 border-t border-b border-red-200 px-5 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <span className="font-body text-[13px] text-red-700 flex-1">
                Remove <strong>{agent.name}</strong>? They will be unassigned from{' '}
                <strong>{assignedCount}</strong> active order(s) and can no longer log in.
              </span>
              <button onClick={onDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white font-brand font-bold text-[11px] px-4 py-1.5 rounded-[5px] transition-colors cursor-pointer">
                Delete
              </button>
              <button onClick={onDeleteCancel}
                className="border border-red-300 text-red-600 font-brand font-medium text-[11px] px-4 py-1.5 rounded-[5px] hover:bg-red-50 cursor-pointer">
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminAgentsPage() {
  const agents = useAgentsStore(state => state.agents)
  const addAgent = useAgentsStore(state => state.addAgent)
  const deleteAgent = useAgentsStore(state => state.deleteAgent)
  const isUsernameAvailable = useAgentsStore(state => state.isUsernameAvailable)
  const updateAgent = useAgentsStore(state => state.updateAgent)

  const orders = useOrderStore(state => state.orders)
  const upsertAgents = useAgentsStore(state => state.upsertAgents)

  // Sync agents from Supabase on mount & listen to realtime updates
  useEffect(() => {
    fetchAgentsFromSupabase().then(fetched => {
      if (fetched) {
        useAgentsStore.setState({ agents: fetched })
      }
    })

    const unsubscribe = subscribeToAgentsRealtime(
      (changedAgent) => {
        upsertAgents([changedAgent])
      },
      (deletedId) => {
        useAgentsStore.setState({
          agents: useAgentsStore.getState().agents.filter(a => a.id !== deletedId)
        })
      }
    )

    return () => unsubscribe()
  }, [upsertAgents])

  // Active agent count
  const activeCount = useMemo(() => agents.filter(a => a.isActive).length, [agents])

  // Current assigned orders per agent (live from orders store)
  const assignedCounts = useMemo(() => {
    const map: Record<string, number> = {}
    agents.forEach(a => {
      map[a.name] = orders.filter(o =>
        o.assignedAgent === a.name &&
        !['delivered', 'cancelled', 'rejected'].includes(o.status)
      ).length
    })
    return map
  }, [agents, orders])

  // Form state
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [whatsappTouched, setWhatsappTouched] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken' | 'short'>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkUsername = (val: string) => {
    if (!val) { setUsernameStatus('idle'); return }
    if (val.length < 4) { setUsernameStatus('short'); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setUsernameStatus(isUsernameAvailable(val) ? 'available' : 'taken')
    }, 300)
  }

  const whatsappValid = /^\d{10,13}$/.test(whatsapp)
  const canAdd =
    name.trim().length > 0 &&
    whatsappValid &&
    username.length >= 4 &&
    usernameStatus === 'available' &&
    password.length >= 4

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    addAgent({
      name: name.trim(),
      whatsapp,
      username,
      password,
      isActive: true,
      vehicleType: null,
      coverageArea: null,
    })
    setName(''); setWhatsapp(''); setUsername(''); setPassword('')
    setUsernameStatus('idle'); setWhatsappTouched(false)
  }

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDeleteConfirm = (agent: Agent) => {
    // Unassign from orders
    orders
      .filter(o => o.assignedAgent === agent.name && !['delivered', 'cancelled', 'rejected'].includes(o.status))
      .forEach(o => {
        useOrderStore.getState().assignAgent(o.id, null)
      })
    deleteAgent(agent.id)
    toast.success(`${agent.name} removed`)
    setDeleteId(null)
  }

  // Edit modal
  const [editAgent, setEditAgent] = useState<Agent | null>(null)

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 bg-[#FAFAFA] min-h-full">

      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-[28px] text-brand-black">Delivery Agents</h1>
          <p className="font-body text-[12px] text-brand-muted mt-1">Admin / Delivery Agents</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-brand-border rounded-[8px] px-4 py-2 shadow-sm">
          <Truck size={14} className="text-brand-red" />
          <span className="font-brand font-semibold text-[12px] text-brand-black">{activeCount} active agent{activeCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ADD AGENT FORM CARD */}
      <div className="bg-white border border-brand-border rounded-[12px] p-6 shadow-sm">
        <h2 className="font-display font-bold text-[19px] text-brand-black mb-5">Add delivery agent</h2>

        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

            {/* Name */}
            <div>
              <FormLabel>Name</FormLabel>
              <input value={name} onChange={e => setName(e.target.value)}
                className={inputCls} placeholder="e.g. Ravi Kumar" />
            </div>

            {/* WhatsApp */}
            <div>
              <FormLabel>WhatsApp number (with country code)</FormLabel>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setWhatsappTouched(true)}
                maxLength={13}
                placeholder="919876543210"
                className={`${inputCls} ${whatsappTouched && !whatsappValid ? 'border-red-400' : ''}`}
              />
              {whatsappTouched && !whatsappValid ? (
                <p className="text-[11px] text-brand-red font-semibold mt-1">Enter a valid number with country code</p>
              ) : (
                <p className="text-[11px] text-brand-muted mt-1">Include country code, no spaces or + — e.g. 919876543210</p>
              )}
            </div>

            {/* Username */}
            <div>
              <FormLabel>Login username</FormLabel>
              <input
                value={username}
                onChange={e => { const v = e.target.value.toLowerCase().replace(/\s/g, ''); setUsername(v); checkUsername(v) }}
                className={`${inputCls} font-mono ${usernameStatus === 'taken' ? 'border-red-400' : usernameStatus === 'available' ? 'border-green-500' : ''}`}
                placeholder="min 4 characters"
              />
              {usernameStatus !== 'idle' && (
                <p className={`text-[11px] mt-1 font-semibold ${usernameStatus === 'available' ? 'text-green-700' : 'text-brand-red'}`}>
                  {usernameStatus === 'available' ? '✓ Username available' :
                   usernameStatus === 'taken' ? '✗ Username already taken' : '✗ Min 4 characters'}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <FormLabel extra={
                <button type="button" onClick={() => { const p = randomPassword(); setPassword(p); setShowPwd(true) }}
                  className="font-brand font-semibold text-[11px] text-brand-red hover:underline cursor-pointer">
                  Generate
                </button>
              }>
                Login password
              </FormLabel>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputCls} pr-11`}
                  placeholder="min 4 characters"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-black transition-colors cursor-pointer">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-brand-muted mt-1">Agent uses this to view their assigned orders</p>
            </div>
          </div>

          <button type="submit" disabled={!canAdd}
            className={`h-[44px] px-6 font-brand font-bold text-[13px] uppercase tracking-[1px] rounded-[8px] transition-colors mt-5 ${
              canAdd
                ? 'bg-brand-red hover:bg-brand-redHover text-white cursor-pointer'
                : 'bg-gray-100 text-brand-muted cursor-not-allowed opacity-60'
            }`}>
            Add agent
          </button>
        </form>
      </div>

      {/* AGENTS TABLE */}
      <div className="bg-white border border-brand-border rounded-[12px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-brand-border">
                {['Name', 'WhatsApp', 'Username', 'Orders', 'Active', 'Actions'].map(h => (
                  <th key={h} className="font-brand font-semibold text-[10px] text-brand-muted uppercase tracking-[1.2px] px-5 py-3.5 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    <span className="font-body text-[14px] text-brand-muted">No agents yet.</span>
                  </td>
                </tr>
              ) : (
                agents.map(agent => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    assignedCount={assignedCounts[agent.name] ?? 0}
                    onEdit={() => setEditAgent(agent)}
                    showDelete={deleteId === agent.id}
                    onDeleteClick={() => setDeleteId(deleteId === agent.id ? null : agent.id)}
                    onDeleteConfirm={() => handleDeleteConfirm(agent)}
                    onDeleteCancel={() => setDeleteId(null)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editAgent && (
        <EditModal agent={editAgent} onClose={() => setEditAgent(null)} />
      )}
    </div>
  )
}
