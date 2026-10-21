import { useState, useEffect } from 'react'
import { useBusiness } from '@/contexts/BusinessContext'
import { isSuperAdmin } from '@/lib/superAdmin'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Unlock } from 'lucide-react'
import { AuthShell, AuthLoader } from './AuthShell'
import { EmptyBusinesses } from './EmptyBusinesses'
import { LockedBusinessLogin } from './LockedBusinessLogin'
import { BusinessPicker } from './BusinessPicker'
import type { LoginFormValues } from './LoginForm'

export { OnboardingDialog } from './OnboardingDialog'

interface BusinessLandingProps {
  onOpenOnboarding: () => void
}

export function BusinessLanding({ onOpenOnboarding }: BusinessLandingProps) {
  const {
    businesses,
    loading: bizLoading,
    selectBusiness,
    deviceLockedBusinessId,
    isDeviceLocked,
    lockBusinessToDevice,
    unlockBusinessFromDevice
  } = useBusiness()
  const { login, loginWithUsername, user } = useAuth()
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [formLogin, setFormLogin] = useState<LoginFormValues>({ identifier: '', password: '' })
  const isSuperAdminUser = user && isSuperAdmin(user.email)

  // Determinar si es email (contiene @) o username
  const isEmail = (identifier: string) => identifier.includes('@')

  // Auto-seleccionar negocio bloqueado al cargar
  useEffect(() => {
    if (deviceLockedBusinessId && businesses.find(b => b.id === deviceLockedBusinessId)) {
      selectBusiness(deviceLockedBusinessId)
      setSelectedBusinessId(deviceLockedBusinessId)
    }
  }, [businesses, selectBusiness, deviceLockedBusinessId])

  const handleLogin = async (identifier: string, password: string, businessId: string) => {
    if (isEmail(identifier)) {
      // Jefe - login con email
      return await login(identifier, password, businessId)
    } else {
      // Trabajador - login con username
      return await loginWithUsername(businessId, identifier, password)
    }
  }

  const performLogin = async (businessId: string) => {
    console.log('Intentando login con:', formLogin.identifier)
    setLoginLoading(true)
    setLoginError(null)
    try {
      const result = await handleLogin(formLogin.identifier, formLogin.password, businessId)
      console.log('Resultado login:', result)
      if (result.success) {
        console.log('Login exitoso, bloqueando dispositivo...')
        lockBusinessToDevice(businessId)
        window.location.reload()
      } else {
        console.log('Login falló:', result.error)
        setLoginError(result.error || 'Error al iniciar sesión')
      }
    } catch (err: unknown) {
      console.error('Error en login:', err)
      setLoginError('Error inesperado: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLoginChange = (field: keyof LoginFormValues, value: string) => {
    setFormLogin((prev) => ({ ...prev, [field]: value }))
  }

  if (bizLoading) {
    return <AuthLoader />
  }

  if (businesses.length === 0) {
    return <EmptyBusinesses onOpenOnboarding={onOpenOnboarding} />
  }

  const lockedBusiness = isDeviceLocked && deviceLockedBusinessId
    ? businesses.find((b) => b.id === deviceLockedBusinessId)
    : undefined

  return (
    <AuthShell
      headerAction={
        isDeviceLocked && isSuperAdminUser ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              unlockBusinessFromDevice()
              setSelectedBusinessId(null)
              window.location.reload()
            }}
            className="text-destructive hover:text-destructive"
          >
            <Unlock className="size-4" aria-hidden />
            Cambiar negocio (SuperAdmin)
          </Button>
        ) : undefined
      }
    >
      <div className="w-full max-w-2xl">
        {lockedBusiness ? (
          // Dispositivo bloqueado a un negocio - mostrar solo login de ese negocio
          <LockedBusinessLogin
            business={lockedBusiness}
            values={formLogin}
            onChange={handleLoginChange}
            onSubmit={(e) => {
              e.preventDefault()
              performLogin(lockedBusiness.id)
            }}
            loading={loginLoading}
            error={loginError}
          />
        ) : (
          // Dispositivo no bloqueado - mostrar selector de negocios
          <BusinessPicker
            businesses={businesses}
            selectedBusinessId={selectedBusinessId}
            onSelectBusiness={(id) => {
              selectBusiness(id)
              setSelectedBusinessId(id)
              setFormLogin({ identifier: '', password: '' })
              setLoginError(null)
            }}
            onBack={() => setSelectedBusinessId(null)}
            onOpenOnboarding={onOpenOnboarding}
            loginValues={formLogin}
            onLoginChange={handleLoginChange}
            onLoginSubmit={(e) => {
              e.preventDefault()
              if (selectedBusinessId) performLogin(selectedBusinessId)
            }}
            loginLoading={loginLoading}
            loginError={loginError}
          />
        )}
      </div>
    </AuthShell>
  )
}
