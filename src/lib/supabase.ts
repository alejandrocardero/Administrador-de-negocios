import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch {
  throw new Error('Invalid VITE_SUPABASE_URL format')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Security: Use PKCE for OAuth flows (enabled by default in newer versions)
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'adminnegocio-pro',
    },
    // Security: Fetch options for all requests
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        // Security: Prevent credential leakage in redirects
        credentials: 'same-origin',
        // Security: Cache control
        cache: 'no-store',
      })
    },
  },
  // Security: Realtime options
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Security: Session validation helper
export async function validateSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return null
  
  // Check token expiry with 5min buffer
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
  const now = Date.now()
  if (expiresAt && expiresAt - now < 5 * 60 * 1000) {
    // Token expiring soon, try refresh
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !newSession) return null
    return newSession
  }
  return session
}

// Security: Get current user with validation
export async function getCurrentUser() {
  const session = await validateSession()
  if (!session?.user) return null
  return session.user
}

export const getSupabase = () => supabase