import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type UserRole = 'jefe' | 'admin' | 'comprador' | 'vendedor'

export interface AuthUser {
  id: string
  email?: string
  role: UserRole
  nombre: string
  username?: string
  business_id: string
  business_nombre: string
  business_slug: string
  is_virtual: boolean
  is_owner: boolean
  membership_id: string
}

type Membership = Database['public']['Functions']['get_user_memberships']['Returns'][number]

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string, businessId?: string) => Promise<{ success: boolean; error?: string }>
  loginWithUsername: (businessId: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginVirtual: (businessId: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  setBusiness: (businessId: string, memberships?: Membership[]) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshingRef = useRef(false)

  const setBusiness = useCallback(async (businessId: string, memberships?: Membership[]) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    // Usar memberships pasados o buscar de nuevo
    const membershipsData = memberships || (await supabase.rpc('get_user_memberships')).data
    if (!membershipsData) return

    // Manejar si es objeto en lugar de array
    const membershipsArray = Array.isArray(membershipsData) ? membershipsData : [membershipsData]
    
    const membership = membershipsArray.find(m => m.business_id === businessId)
    if (!membership) return

    localStorage.setItem('current_business_id', businessId)

    setUser({
      id: session.user.id,
      email: session.user.email,
      role: membership.role as UserRole,
      nombre: membership.nombre,
      username: membership.username,
      business_id: membership.business_id,
      business_nombre: membership.business_nombre,
      business_slug: membership.business_slug,
      is_virtual: membership.is_virtual,
      is_owner: membership.is_owner,
      membership_id: membership.id
    })
  }, [])

  const refreshUser = useCallback(async () => {
    if (refreshingRef.current) {
      console.log('refreshUser ya en progreso, saltando')
      return
    }
    refreshingRef.current = true
    
    try {
      console.log('refreshUser iniciado')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Sesión obtenida:', session ? 'existe' : 'null')
      setSession(session)

      if (!session?.user) {
        console.log('No hay sesión de usuario')
        setUser(null)
        return
      }

      console.log('Usuario autenticado:', session.user.email)
      console.log('Llamando a get_user_memberships...')
      const { data: memberships, error } = await supabase.rpc('get_user_memberships')
      console.log('get_user_memberships retornó:', { memberships, error })
      if (error || !memberships) {
        console.log('No hay memberships o error')
        setUser(null)
        return
      }

      // Manejar si es objeto en lugar de array
      const membershipsArray: Membership[] = Array.isArray(memberships) ? memberships : [memberships]
      if (membershipsArray.length === 0) {
        console.log('Array de memberships vacío')
        setUser(null)
        return
      }

      const storedBusinessId = localStorage.getItem('current_business_id')
      console.log('Business ID guardado:', storedBusinessId)
      let membership = membershipsArray.find(m => m.business_id === storedBusinessId)
      if (!membership) {
        console.log('No se encontró membership para business_id, usando el primero')
        membership = membershipsArray[0]
      }

      console.log('Membership seleccionado:', membership)
      await setBusiness(membership.business_id, membershipsArray)
    } finally {
      refreshingRef.current = false
      setLoading(false)
    }
  }, [setBusiness])

  const login = useCallback(async (email: string, password: string, businessId?: string) => {
    console.log('login llamado con:', email, 'businessId:', businessId)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.log('Error en signInWithPassword:', error.message)
      return { success: false, error: error.message }
    }

    console.log('signInWithPassword exitoso, verificando membership...')
    
    // Verificar que el usuario tenga membership en el negocio seleccionado
    const targetBusinessId = businessId || localStorage.getItem('current_business_id')
    if (targetBusinessId) {
      const { data: memberships, error: membershipError } = await supabase.rpc('get_user_memberships')
      console.log('Memberships para validación:', memberships, membershipError)
      
      if (!membershipError && memberships) {
        const membershipsArray: Membership[] = Array.isArray(memberships) ? memberships : [memberships]
        const hasMembership = membershipsArray.some(m => m.business_id === targetBusinessId)
        
        if (!hasMembership) {
          console.log('Usuario no tiene acceso a este negocio')
          await supabase.auth.signOut()
          return { success: false, error: 'No tienes acceso a este negocio. Verifica tus credenciales.' }
        }
      }
    }

    console.log('Membership válido, llamando refreshUser...')
    await refreshUser()
    console.log('refreshUser completado después de login')
    return { success: true }
  }, [refreshUser])

  const loginVirtual = useCallback(async (businessId: string, username: string, password: string) => {
    const local = username.trim().toLowerCase()
    if (!local || !password) {
      return { success: false, error: 'Ingresa usuario y contraseña' }
    }

    const { data: businessList, error: listError } = await supabase.rpc('list_businesses_for_login')
    if (listError) {
      return { success: false, error: 'No se pudo cargar el negocio' }
    }

    const business = (businessList || []).find((b: { id: string; slug: string }) => b.id === businessId)
    if (!business) {
      return { success: false, error: 'Negocio no encontrado' }
    }

    const email = `${local}@${business.slug}.app`
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { success: false, error: 'Usuario o contraseña incorrectos' }
    }

    localStorage.setItem('current_business_id', businessId)
    await refreshUser()
    return { success: true }
  }, [refreshUser])

  const loginWithUsername = useCallback(async (businessId: string, username: string, password: string) => {
    console.log('loginWithUsername:', username, 'businessId:', businessId)
    
    // Usar loginVirtual existente que construye email = username@slug.app
    const result = await loginVirtual(businessId, username, password)
    if (!result.success) return result
    
    // Bloquear dispositivo al negocio tras login exitoso
    localStorage.setItem('device_business_id', businessId)
    return { success: true }
  }, [loginVirtual])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    // NO removemos current_business_id para que vuelva al login de ese negocio
    setUser(null)
    setSession(null)
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) {
          console.error('Error getting session:', error)
          setLoading(false)
          return
        }
        setSession(session)

        if (session?.user) {
          await refreshUser()
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) setLoading(false)
      }
    }
    init()

    // Timeout de seguridad: si en 10s no resuelve, forzar loading=false
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Auth init timeout - forcing loading=false')
        setLoading(false)
      }
    }, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) {
        refreshUser()
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [refreshUser])

  return (
    <AuthContext.Provider value={{ user, session, loading, login, loginWithUsername, loginVirtual, logout, setBusiness, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}