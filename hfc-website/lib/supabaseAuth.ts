import { supabase } from './supabase'

/**
 * Authenticate Admin via Supabase Auth.
 * Never throws — returns false silently on any failure so caller can fall back.
 */
export async function authenticateAdminSupabase(
  emailOrUsername: string,
  passwordOrPin: string
): Promise<boolean> {
  try {
    const cleanInput = emailOrUsername.trim().toLowerCase()
    const suppliedPassword = passwordOrPin.trim()

    if (!suppliedPassword) return false

    const email = cleanInput.includes('@')
      ? cleanInput
      : (cleanInput === 'hfc_admin' || cleanInput === 'admin'
          ? 'admin@hfcconsultancy.com'
          : `${cleanInput}@hfc-admin-system.com`)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: suppliedPassword,
    })

    if (!error && data?.session && data?.user?.user_metadata?.role === 'admin') {
      console.log('Admin Supabase Auth login successful ✓')
      return true
    }

    // If login failed, try to auto-sign up the default admin account.
    // Suppress all errors here — if signUp fails (e.g. email confirm required, weak password),
    // the caller will fall back to local auth anyway.
    if (error) {
      const isDefault = (cleanInput === 'admin' || cleanInput === 'hfc_admin')
      if (isDefault) {
        try {
          await supabase.auth.signUp({
            email,
            password: suppliedPassword,
            options: {
              data: { role: 'admin', username: cleanInput },
              emailRedirectTo: undefined,
            },
          })
        } catch (_) {
          // swallow — local fallback will handle it
        }
      }
    }

    return false
  } catch (err) {
    console.warn('Admin Supabase Auth skipped (non-critical):', err)
    return false
  }
}


export async function authenticateAgentSupabase(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; session?: any }> {
  try {
    const email = `${username.toLowerCase().trim()}@hfc-agents.com`
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, session: data.session }
  } catch (err: any) {
    return { success: false, error: err.message || 'Authentication failed' }
  }
}

/**
 * Check active Supabase Auth session on app load.
 * Never throws.
 */
export async function checkSupabaseAuthSession() {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session
  } catch (err) {
    return null
  }
}
