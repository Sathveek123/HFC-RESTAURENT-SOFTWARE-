import { create } from 'zustand'
import { useAgentsStore, Agent } from './agentsStore'
import { authenticateAgentSupabase, checkSupabaseAuthSession } from '@/lib/supabaseAuth'
import { fetchAgentsFromSupabase } from '@/lib/supabaseSync'

interface AgentAuthStore {
  isAuthenticated: boolean
  loggedInAgentId: string | null
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  checkSession: () => void
  getLoggedInAgent: () => Agent | undefined
}

export const useAgentAuthStore = create<AgentAuthStore>((set, get) => ({
  isAuthenticated: false,
  loggedInAgentId: null,

  login: async (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase()
    const cleanPassword = password.trim()

    // 1. Authenticate with Supabase Auth for RLS JWT token issuance
    const authRes = await authenticateAgentSupabase(cleanUsername, cleanPassword)
    if (!authRes.success) {
      return { success: false, error: authRes.error || 'Incorrect username or password.' }
    }

    // 2. Now that we are authenticated, sync latest delivery agents from Supabase
    let agents: Agent[] = []
    try {
      const fetched = await fetchAgentsFromSupabase()
      if (fetched && fetched.length > 0) {
        useAgentsStore.getState().upsertAgents(fetched)
        agents = fetched
      } else {
        agents = useAgentsStore.getState().agents
      }
    } catch (e) {
      console.warn('Failed to sync agents on login:', e)
      agents = useAgentsStore.getState().agents
    }

    const agent = agents.find(
      a => (a.username || '').trim().toLowerCase() === cleanUsername
    )

    if (!agent) {
      // Sign out since profile wasn't found in agents table
      const { supabase } = require('@/lib/supabase')
      await supabase.auth.signOut()
      return { success: false, error: 'Agent profile not found in kitchen records.' }
    }

    if (!agent.isActive) {
      // Sign out since agent is inactive
      const { supabase } = require('@/lib/supabase')
      await supabase.auth.signOut()
      return {
        success: false,
        error: 'Your account is currently inactive. Contact HFC admin.'
      }
    }

    // Save session to localStorage so agent stays logged in across tab close/refresh
    if (typeof window !== 'undefined') {
      localStorage.setItem('hfc-agent-session', agent.id)
    }

    set({ isAuthenticated: true, loggedInAgentId: agent.id })
    return { success: true }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hfc-agent-session')
    }
    set({ isAuthenticated: false, loggedInAgentId: null })
  },

  checkSession: () => {
    if (typeof window !== 'undefined') {
      const agentId = localStorage.getItem('hfc-agent-session')
      if (agentId) {
        const agent = useAgentsStore.getState().agents.find(a => a.id === agentId)
        if (agent && agent.isActive) {
          set({ isAuthenticated: true, loggedInAgentId: agentId })
          return
        }
      }
      set({ isAuthenticated: false, loggedInAgentId: null })
    }
  },

  getLoggedInAgent: () => {
    const { loggedInAgentId } = get()
    if (!loggedInAgentId) return undefined
    return useAgentsStore.getState().agents.find(a => a.id === loggedInAgentId)
  }
}))
