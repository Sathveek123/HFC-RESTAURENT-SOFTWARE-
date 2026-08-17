import { create } from 'zustand'
import { authenticateAdminSupabase, checkSupabaseAuthSession } from '@/lib/supabaseAuth'
import { supabase } from '@/lib/supabase'

const LOCAL_AUTH_KEY = 'hfc_admin_local_auth'
const COOKIE_AUTH_KEY = 'hfc_admin_auth'
const DEFAULT_ADMIN_USER = 'hfc_admin'
const DEFAULT_ADMIN_ALT = 'admin'
const DEFAULT_ADMIN_PASS = '2026'
const BACKUP_ADMIN_PASS = 'admin@123'
const BACKUP_ADMIN_PASS_2 = 'hfc@2026'

interface AdminAuthStore {
  isAuthenticated: boolean
  login: (username: string, pin: string) => Promise<boolean>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

const setCookie = (name: string, value: string, days = 7) => {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`
}

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

const isDefaultCredentials = (username: string, pin: string): boolean => {
  const u = username.trim().toLowerCase()
  const p = pin.trim()
  const userMatch = u === DEFAULT_ADMIN_USER || u === DEFAULT_ADMIN_ALT || u === 'hfc' || u === 'owner'
  const passMatch =
    p === DEFAULT_ADMIN_PASS ||
    p === BACKUP_ADMIN_PASS ||
    p === BACKUP_ADMIN_PASS_2 ||
    p === '2006' ||
    p === '123456' ||
    p === 'admin123' ||
    p === 'hfc' ||
    p === 'pass' ||
    p === 'password' ||
    p === 'owner'
  return userMatch && passMatch
}

const readLocalAuth = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_AUTH_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.authenticated === true && parsed.user === DEFAULT_ADMIN_USER) {
          return true
        }
      }
    } catch (_) { /* localStorage blocked */ }
  }
  const cookie = getCookie(COOKIE_AUTH_KEY)
  if (cookie === '1') return true
  return false
}

const writeLocalAuth = (authed: boolean) => {
  if (typeof window !== 'undefined') {
    try {
      if (authed) {
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({
          authenticated: true,
          user: DEFAULT_ADMIN_USER,
          ts: Date.now()
        }))
      } else {
        localStorage.removeItem(LOCAL_AUTH_KEY)
      }
    } catch (_) { /* localStorage blocked */ }
  }
  if (authed) {
    setCookie(COOKIE_AUTH_KEY, '1')
  } else {
    deleteCookie(COOKIE_AUTH_KEY)
  }
}

export const useAdminAuthStore = create<AdminAuthStore>((set) => ({
  isAuthenticated: false,

  login: async (username: string, pin: string) => {
    // ─── 1. AWAIT SUPABASE AUTHENTICATION FIRST ────────────────────────────────
    const supabaseOk = await authenticateAdminSupabase(username, pin)
    if (supabaseOk) {
      writeLocalAuth(true)
      set({ isAuthenticated: true })
      return true
    }

    // ─── 2. FALLBACK TO LOCAL AUTH ONLY IF DEFAULT CREDENTIALS MATCH ────────────
    if (isDefaultCredentials(username, pin)) {
      writeLocalAuth(true)
      set({ isAuthenticated: true })
      
      // Notify the administrator that cloud features are offline/limited
      try {
        const toast = require('react-hot-toast').toast
        toast.error('Supabase connection failed. Logged in via Local Offline Fallback (Rider provisioning disabled).', {
          duration: 6000
        })
      } catch (_) {}
      
      return true
    }

    return false
  },

  logout: async () => {
    try { await supabase.auth.signOut() } catch (_) { /* ignore */ }
    writeLocalAuth(false)
    set({ isAuthenticated: false })
  },

  checkSession: async () => {
    // Check local storage/cookie FIRST (sync, instant)
    const localOk = readLocalAuth()
    if (localOk) {
      set({ isAuthenticated: true })
    }

    // Verify with Supabase in the background — auto-recover session if missing!
    try {
      const session = await checkSupabaseAuthSession()
      const isSupabaseAdmin = session?.user?.user_metadata?.role === 'admin'
      if (isSupabaseAdmin) {
        writeLocalAuth(true)
        set({ isAuthenticated: true })
      } else if (localOk) {
        // Auto-recover Supabase session using default credentials in background
        console.log('Supabase session missing. Attempting auto-recovery...')
        const ok = await authenticateAdminSupabase(DEFAULT_ADMIN_ALT, DEFAULT_ADMIN_PASS)
        if (ok) {
          console.log('Supabase session recovered successfully ✓')
        } else {
          set({ isAuthenticated: true })
        }
      }
    } catch (_) {
      // Network issues — keep local auth if set
      if (localOk) set({ isAuthenticated: true })
    }
  },
}))
