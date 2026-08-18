import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncAgentToSupabase, deleteAgentFromSupabase } from '@/lib/supabaseSync'

export interface Agent {
  id: string
  name: string
  whatsapp: string              // numeric with country code e.g. "919876543210"
  username: string              // unique, lowercase
  isActive: boolean
  vehicleType: 'bike' | 'bicycle' | 'scooter' | 'on-foot' | null
  coverageArea: string | null
  createdAt: string
  totalDeliveries: number
  deliveryRate: number          // commission per order
}

interface AgentsStore {
  agents: Agent[]
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'totalDeliveries'> & { password?: string }) => Promise<void>
  upsertAgents: (incoming: Agent[]) => void
  updateAgent: (id: string, updates: Partial<Agent> & { password?: string }) => Promise<void>
  deleteAgent: (id: string) => void
  toggleAgentActive: (id: string) => void
  incrementDeliveries: (id: string) => void
  isUsernameAvailable: (username: string, excludeId?: string) => boolean
  getActiveAgents: () => Agent[]
  getAgentByUsername: (username: string) => Agent | undefined
}
export const useAgentsStore = create<AgentsStore>()(
  persist(
    (set, get) => ({
      agents: [],

      addAgent: async (newAgent) => {
        try {
          const { supabase } = require('@/lib/supabase')
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            const err = 'Admin session not found. Please log in again.'
            console.error('Cannot provision agent:', err)
            const toast = require('react-hot-toast').toast
            toast.error(err)
            return
          }

          const res = await fetch('/api/admin/agents/provision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              name: newAgent.name,
              username: newAgent.username,
              password: newAgent.password,
              whatsapp: newAgent.whatsapp,
              coverageArea: newAgent.coverageArea || 'Central',
              vehicleType: newAgent.vehicleType || 'Bike',
              deliveryRate: newAgent.deliveryRate !== undefined ? newAgent.deliveryRate : 40,
            })
          })

          const data = await res.json()
          if (data.error) {
            console.error('Failed to provision agent:', data.error)
            const toast = require('react-hot-toast').toast
            toast.error(`Auth creation failed: ${data.error}`)
            return
          }

          if (data.success && data.agent) {
            const agent: Agent = {
              id: data.agent.id,
              name: data.agent.name,
              whatsapp: newAgent.whatsapp,
              username: data.agent.username,
              isActive: data.agent.is_active,
              vehicleType: data.agent.vehicle_type,
              coverageArea: data.agent.coverage_area,
              createdAt: data.agent.created_at,
              totalDeliveries: data.agent.total_deliveries || 0,
              deliveryRate: Number(data.agent.delivery_rate) || 40,
            }
            set({ agents: [...get().agents, agent] })
            await syncAgentToSupabase(agent)
            const toast = require('react-hot-toast').toast
            toast.success(`Agent ${agent.name} provisioned securely ✓`)
          }
        } catch (e: any) {
          console.error('Error provisioning agent:', e)
          const toast = require('react-hot-toast').toast
          toast.error(`Provisioning error: ${e.message || e}`)
        }
      },

      upsertAgents: (incoming) => {
        const existing = get().agents
        const existingMap = new Map(existing.map(a => [a.id, a]))
        incoming.forEach(a => existingMap.set(a.id, a))
        set({ agents: Array.from(existingMap.values()) })
      },

      updateAgent: async (id, updates) => {
        const currentAgent = get().agents.find(a => a.id === id)
        if (!currentAgent) return

        try {
          const { supabase } = require('@/lib/supabase')
          const { data: { session } } = await supabase.auth.getSession()
          
          // If we have an active admin session and updates to credentials/meta, sync to Supabase Auth
          if (session && (updates.password || updates.name || updates.username || updates.whatsapp || updates.deliveryRate !== undefined)) {
            const mergedPayload = {
              id,
              name: updates.name !== undefined ? updates.name : currentAgent.name,
              username: updates.username !== undefined ? updates.username : currentAgent.username,
              password: updates.password || '',
              whatsapp: updates.whatsapp !== undefined ? updates.whatsapp : currentAgent.whatsapp,
              coverageArea: updates.coverageArea !== undefined ? updates.coverageArea : currentAgent.coverageArea || '',
              vehicleType: updates.vehicleType !== undefined ? updates.vehicleType : currentAgent.vehicleType || '',
              deliveryRate: updates.deliveryRate !== undefined ? updates.deliveryRate : currentAgent.deliveryRate !== undefined ? currentAgent.deliveryRate : 40,
            }

            const res = await fetch('/api/admin/agents/provision', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify(mergedPayload)
            })

            const resData = await res.json()
            if (resData.error) {
              console.error('Failed to update agent credentials in Auth:', resData.error)
              const toast = require('react-hot-toast').toast
              toast.error(`Auth update failed: ${resData.error}`)
              return
            }

            if (resData.success && resData.agent) {
              const cleanAgent: Agent = {
                id: resData.agent.id,
                name: resData.agent.name,
                whatsapp: resData.agent.whatsapp,
                username: resData.agent.username,
                isActive: resData.agent.is_active,
                vehicleType: resData.agent.vehicle_type,
                coverageArea: resData.agent.coverage_area,
                createdAt: resData.agent.created_at,
                totalDeliveries: resData.agent.total_deliveries || 0,
                deliveryRate: Number(resData.agent.delivery_rate) || 40,
              }
              // If the agent ID changed (dummy migrated to UUID), filter out the old ID row
              const list = get().agents.filter(a => a.id !== id)
              set({ agents: [...list, cleanAgent] })
              await syncAgentToSupabase(cleanAgent)
              const toast = require('react-hot-toast').toast
              toast.success(`${cleanAgent.name} updated successfully ✓`)
              return
            }
          }
        } catch (e: any) {
          console.error('Error updating agent credentials:', e)
          const toast = require('react-hot-toast').toast
          toast.error(`Auth update error: ${e.message || e}`)
          return
        }

        // Apply local state updates and sync to public.agents (fallback if no API credentials updates are triggerable)
        const { password, ...cleanUpdates } = updates
        set({ agents: get().agents.map(a => a.id === id ? { ...a, ...cleanUpdates } : a) })
        const updated = get().agents.find(a => a.id === id)
        if (updated) {
          await syncAgentToSupabase(updated)
          const toast = require('react-hot-toast').toast
          toast.success(`${updated.name} updated successfully ✓`)
        }
      },

      deleteAgent: (id) => {
        set({ agents: get().agents.filter(a => a.id !== id) })
        deleteAgentFromSupabase(id)
      },

      toggleAgentActive: (id) => {
        set({ agents: get().agents.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a) })
        const updated = get().agents.find(a => a.id === id)
        if (updated) {
          syncAgentToSupabase(updated)
        }
      },

      incrementDeliveries: (id) => {
        set({ agents: get().agents.map(a => a.id === id ? { ...a, totalDeliveries: a.totalDeliveries + 1 } : a) })
        const updated = get().agents.find(a => a.id === id)
        if (updated) {
          syncAgentToSupabase(updated)
        }
      },

      isUsernameAvailable: (username, excludeId) => {
        return !get().agents.some(a =>
          a.username.toLowerCase() === username.toLowerCase() && a.id !== excludeId
        )
      },

      getActiveAgents: () => get().agents.filter(a => a.isActive),

      getAgentByUsername: (username) =>
        get().agents.find(a => a.username.toLowerCase() === username.toLowerCase()),
    }),
    { name: 'hfc-agents' }
  )
)
