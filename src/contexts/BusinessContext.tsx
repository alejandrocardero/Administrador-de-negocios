import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { TablesUpdate } from '@/types/database'
import { isSuperAdmin } from '@/lib/superAdmin'
import type { Database } from '@/types/database'

type Membership = Database['public']['Functions']['get_user_memberships']['Returns'][number]

export interface Business {
  id: string
  nombre: string
  slug: string
  nit?: string
  direccion?: string
  telefono?: string
  email?: string
  regimen: string
  tarifa_iva: number
  moneda: string
  owner_id: string
  created_at: string
  updated_at: string
  role?: 'jefe' | 'admin' | 'comprador' | 'vendedor'
  is_owner: boolean
}

interface BusinessContextType {
  businesses: Business[]
  currentBusiness: Business | null
  loading: boolean
  deviceLockedBusinessId: string | null
  isDeviceLocked: boolean
  refreshBusinesses: () => Promise<void>
  switchBusiness: (businessId: string) => Promise<void>
  selectBusiness: (businessId: string) => Promise<{ success: boolean; needsLogin: boolean; business?: Business }>
  lockBusinessToDevice: (businessId: string) => void
  unlockBusinessFromDevice: () => void
  canSwitchBusiness: () => boolean
  createBusiness: (data: CreateBusinessData) => Promise<{ success: boolean; error?: string; businessId?: string; credentials?: Database['public']['Functions']['onboard_business']['Returns']['credentials'] }>
  updateBusiness: (businessId: string, data: Partial<Business>) => Promise<void>
}

export interface CreateBusinessData {
  nombre: string
  slug: string
  nit?: string
  direccion?: string
  telefono?: string
  email?: string
  regimen?: string
  tarifa_iva?: number
  moneda?: string
  jefe_nombre: string
  jefe_email: string
  jefe_password: string
  roles: {
    admin: { username: string; password: string; nombre: string }
    comprador: { username: string; password: string; nombre: string }
    vendedor: { username: string; password: string; nombre: string }
  }
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

const DEVICE_BUSINESS_KEY = 'device_business_id'

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceLockedBusinessId, setDeviceLockedBusinessId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DEVICE_BUSINESS_KEY)
    }
    return null
  })

  const isDeviceLocked = !!deviceLockedBusinessId
  const canSwitchBusiness = useCallback(() => isSuperAdmin(user?.email) || !isDeviceLocked, [user?.email, isDeviceLocked])

  const fetchBusinesses = useCallback(async () => {
    if (!user) {
      const { data } = await supabase.rpc('list_businesses_for_login')
      const list: Business[] = (data || []).map((b: { id: string; nombre: string; slug: string }) => ({
        id: b.id,
        nombre: b.nombre,
        slug: b.slug,
        is_owner: false,
        nit: '',
        direccion: '',
        telefono: '',
        email: '',
        regimen: '',
        tarifa_iva: 0,
        moneda: '',
        owner_id: '',
        created_at: '',
        updated_at: ''
      }))
      setBusinesses(list)
      setCurrentBusiness(list[0] || null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.rpc('get_user_memberships')
    if (error || !data) {
      setBusinesses([])
      setLoading(false)
      return
    }

    const memberships: Membership[] = Array.isArray(data) ? data : [data]
    const businessList: Business[] = memberships.map((m) => ({
      id: m.business_id,
      nombre: m.business_nombre,
      slug: m.business_slug,
      role: m.role as Business['role'],
      is_owner: m.is_owner,
      nit: '',
      direccion: '',
      telefono: '',
      email: '',
      regimen: '',
      tarifa_iva: 0,
      moneda: '',
      owner_id: '',
      created_at: '',
      updated_at: ''
    }))

    setBusinesses(businessList)

    // Si hay device lock, usar ese negocio; sino el guardado
    const storedId = deviceLockedBusinessId || localStorage.getItem('current_business_id')
    const current = businessList.find(b => b.id === storedId) || businessList[0]
    if (current) {
      setCurrentBusiness(current)
    }
    setLoading(false)
  }, [user, deviceLockedBusinessId])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      await fetchBusinesses()
    }
    init()

    // Timeout de seguridad
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Business init timeout - forcing loading=false')
        setLoading(false)
      }
    }, 10000)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [fetchBusinesses])

  const switchBusiness = useCallback(async (businessId: string) => {
    if (!canSwitchBusiness()) {
      console.log('No autorizado para cambiar de negocio en este dispositivo')
      return
    }
    const business = businesses.find(b => b.id === businessId)
    if (!business) return

    localStorage.setItem('current_business_id', businessId)
    setCurrentBusiness(business)
    await refreshUser()
  }, [businesses, refreshUser, canSwitchBusiness])

  const selectBusiness = useCallback(async (businessId: string) => {
    console.log('selectBusiness llamado con:', businessId)
    const business = businesses.find(b => b.id === businessId)
    if (!business) {
      console.log('Negocio no encontrado')
      return { success: false, needsLogin: false }
    }

    localStorage.setItem('current_business_id', businessId)
    setCurrentBusiness(business)
    console.log('Llamando a refreshUser...')
    await refreshUser()
    console.log('refreshUser completado')

    return { success: true, needsLogin: true, business }
  }, [businesses, refreshUser])

  const lockBusinessToDevice = useCallback((businessId: string) => {
    localStorage.setItem(DEVICE_BUSINESS_KEY, businessId)
    setDeviceLockedBusinessId(businessId)
  }, [])

  const unlockBusinessFromDevice = useCallback(() => {
    localStorage.removeItem(DEVICE_BUSINESS_KEY)
    setDeviceLockedBusinessId(null)
  }, [])

  const createBusiness = useCallback(async (data: CreateBusinessData) => {
    const { data: result, error } = await supabase.rpc('onboard_business', {
      p_nombre: data.nombre,
      p_slug: data.slug,
      p_nit: data.nit || null,
      p_direccion: data.direccion || null,
      p_telefono: data.telefono || null,
      p_email: data.email || null,
      p_regimen: data.regimen || null,
      p_tarifa_iva: data.tarifa_iva ?? 0,
      p_moneda: data.moneda || 'Gs.',
      p_jefe_nombre: data.jefe_nombre,
      p_jefe_email: data.jefe_email,
      p_jefe_password: data.jefe_password,
      p_roles_json: data.roles
    })

    if (error || !result) {
      return { success: false, error: error?.message || 'Error al crear negocio' }
    }

    localStorage.setItem('current_business_id', result.business_id)
    await fetchBusinesses()
    await refreshUser()

    return { success: true, businessId: result.business_id as string, credentials: result.credentials }
  }, [fetchBusinesses, refreshUser])

  const updateBusiness = useCallback(async (businessId: string, data: Partial<Business>) => {
    const { error } = await supabase
      .from('businesses')
      .update(data as TablesUpdate<'businesses'>)
      .eq('id', businessId)

    if (error) throw error

    await fetchBusinesses()
  }, [fetchBusinesses])

  const refreshBusinesses = useCallback(async () => {
    await fetchBusinesses()
  }, [fetchBusinesses])

  return (
    <BusinessContext.Provider value={{
      businesses,
      currentBusiness,
      loading,
      deviceLockedBusinessId,
      isDeviceLocked,
      refreshBusinesses,
      switchBusiness,
      selectBusiness,
      lockBusinessToDevice,
      unlockBusinessFromDevice,
      canSwitchBusiness,
      createBusiness,
      updateBusiness
    }}>
      {children}
    </BusinessContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusiness() {
  const context = useContext(BusinessContext)
  if (!context) throw new Error('useBusiness must be used within BusinessProvider')
  return context
}