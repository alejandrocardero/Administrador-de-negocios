import { useState, useEffect } from 'react'
import { useBusiness } from '@/contexts/BusinessContext'
import { isSuperAdmin } from '@/lib/superAdmin'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, Plus, Lock, Unlock } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog'

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
  const [formLogin, setFormLogin] = useState({ identifier: '', password: '' })
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

  if (bizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-slate-900">AdminNegocio Pro</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <Card>
              <CardHeader className="text-center">
                <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <CardTitle className="text-2xl">No hay negocios registrados</CardTitle>
                <CardDescription className="text-slate-500">
                  Para comenzar, registra tu primer negocio
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-4">
                <Button 
                  size="lg" 
                  className="w-full gap-2"
                  onClick={onOpenOnboarding}
                >
                  <Plus className="w-5 h-5" />
                  Registrar mi negocio
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-slate-900">AdminNegocio Pro</span>
            </div>
            {isDeviceLocked && isSuperAdminUser && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  unlockBusinessFromDevice()
                  setSelectedBusinessId(null)
                  window.location.reload()
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Unlock className="w-4 h-4 mr-1" />
                Cambiar negocio (SuperAdmin)
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {isDeviceLocked && deviceLockedBusinessId ? (
            // Dispositivo bloqueado a un negocio - mostrar solo login de ese negocio
            (() => {
              const lockedBusiness = businesses.find(b => b.id === deviceLockedBusinessId)
              if (!lockedBusiness) return null
              
              return (
                <Card>
                  <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Building2 className="w-10 h-10 text-blue-600" />
                      <Lock className="w-5 h-5 text-amber-500" />
                    </div>
                    <CardTitle>Acceso a {lockedBusiness.nombre}</CardTitle>
                    <CardDescription className="text-slate-500">
                      Este dispositivo está configurado para {lockedBusiness.nombre}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loginError && (
                      <Alert variant="destructive" className="text-sm">
                        <AlertDescription>{loginError}</AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      console.log('Intentando login con:', formLogin.identifier)
                      setLoginLoading(true)
                      setLoginError(null)
                      try {
                        const result = await handleLogin(formLogin.identifier, formLogin.password, deviceLockedBusinessId)
                        console.log('Resultado login:', result)
                        if (result.success) {
                          console.log('Login exitoso, bloqueando dispositivo...')
                          lockBusinessToDevice(deviceLockedBusinessId)
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
                    }} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="identifier">Usuario / Email</Label>
                        <Input
                          id="identifier"
                          type="text"
                          value={formLogin.identifier}
                          onChange={e => setFormLogin({ ...formLogin, identifier: e.target.value })}
                          placeholder="usuario o email@dominio.com"
                          required
                          autoComplete="username"
                          disabled={loginLoading}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formLogin.password}
                          onChange={e => setFormLogin({ ...formLogin, password: e.target.value })}
                          placeholder="Tu contraseña"
                          required
                          autoComplete="current-password"
                          disabled={loginLoading}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={loginLoading} size="lg">
                        {loginLoading ? 'Entrando...' : 'Iniciar sesión'}
                      </Button>
                    </form>

                    <p className="text-xs text-slate-500 text-center">
                      Jefe: usa tu email<br/>
                      Admin/Comprador/Vendedor: usa tu usuario (ej: admin, comprador, vendedor)
                    </p>
                  </CardContent>
                </Card>
              )
            })()
          ) : (
            // Dispositivo no bloqueado - mostrar selector de negocios
            <Card>
              <CardHeader className="text-center">
                <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <CardTitle>Selecciona tu Negocio</CardTitle>
                <CardDescription className="text-slate-500">
                  Elige el negocio al que quieres acceder
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {businesses.map(biz => (
                  <Button
                    key={biz.id}
                    variant="outline"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      selectBusiness(biz.id)
                      setSelectedBusinessId(biz.id)
                      setFormLogin({ identifier: '', password: '' })
                      setLoginError(null)
                    }}
                  >
                    <Building2 className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-medium">{biz.nombre}</p>
                      <p className="text-xs text-slate-500">{biz.slug}</p>
                    </div>
                  </Button>
                ))}

                {selectedBusinessId && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">
                        Iniciar sesión en: <span className="text-blue-600">
                          {businesses.find(b => b.id === selectedBusinessId)?.nombre}
                        </span>
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBusinessId(null)}>
                        Volver
                      </Button>
                    </div>

                    {loginError && (
                      <Alert variant="destructive" className="text-sm">
                        <AlertDescription>{loginError}</AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      console.log('Intentando login con:', formLogin.identifier)
                      setLoginLoading(true)
                      setLoginError(null)
                      try {
                        const result = await handleLogin(formLogin.identifier, formLogin.password, selectedBusinessId)
                        console.log('Resultado login:', result)
                        if (result.success) {
                          console.log('Login exitoso, bloqueando dispositivo...')
                          lockBusinessToDevice(selectedBusinessId!)
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
                    }} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="identifier">Usuario / Email</Label>
                        <Input
                          id="identifier"
                          type="text"
                          value={formLogin.identifier}
                          onChange={e => setFormLogin({ ...formLogin, identifier: e.target.value })}
                          placeholder="usuario o email@dominio.com"
                          required
                          autoComplete="username"
                          disabled={loginLoading}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formLogin.password}
                          onChange={e => setFormLogin({ ...formLogin, password: e.target.value })}
                          placeholder="Tu contraseña"
                          required
                          autoComplete="current-password"
                          disabled={loginLoading}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={loginLoading} size="lg">
                        {loginLoading ? 'Entrando...' : 'Iniciar sesión'}
                      </Button>
                    </form>

                    <p className="text-xs text-slate-500 text-center">
                      Jefe: usa tu email<br/>
                      Admin/Comprador/Vendedor: usa tu usuario (ej: admin, comprador, vendedor)
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500 text-center mb-3">
                    ¿No aparece tu negocio?
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 text-blue-600 hover:bg-blue-50 border-blue-200"
                    onClick={onOpenOnboarding}
                  >
                    <Plus className="w-4 h-4" />
                    Registrar nuevo negocio
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

export function OnboardingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createBusiness } = useBusiness()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
    regimen: 'simplificado',
    tarifa_iva: 19,
    moneda: 'COP',
    jefe_nombre: '',
    jefe_email: '',
    jefe_password: '',
    roles: {
      admin: { username: 'admin', password: 'admin123', nombre: 'Administrador' },
      comprador: { username: 'comprador', password: 'compra123', nombre: 'Comprador' },
      vendedor: { username: 'vendedor', password: 'vende123', nombre: 'Vendedor' },
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await createBusiness(formData)
      const credentials = result.credentials as { jefe?: { email: string; password: string } } | undefined
      if (result.success && credentials?.jefe) {
        const { email, password } = credentials.jefe
        const loginResult = await login(email, password)
        if (loginResult.success) {
          onOpenChange(false)
          window.location.reload()
        } else {
          setError('Negocio creado pero error al iniciar sesión: ' + (loginResult.error || ''))
        }
      } else if (result.success) {
        onOpenChange(false)
        window.location.reload()
      } else {
        setError(result.error || 'Error al crear el negocio')
      }
    } catch {
      setError('Error inesperado al crear el negocio')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Negocio</DialogTitle>
          <DialogDescription>
            Completa los datos para crear tu negocio y las cuentas de acceso
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Datos del Negocio</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Negocio *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: La Prodigiosa"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="la-prodigiosa"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">NIT</Label>
              <Input
                id="nit"
                value={formData.nit}
                onChange={e => setFormData({ ...formData, nit: e.target.value })}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Dirección completa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="3001234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@negocio.com"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Configuración Fiscal</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="regimen">Régimen</Label>
                <select
                  id="regimen"
                  value={formData.regimen}
                  onChange={e => setFormData({ ...formData, regimen: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="simplificado">Simplificado</option>
                  <option value="comun">Común</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarifa_iva">Tarifa IVA %</Label>
                <Input
                  id="tarifa_iva"
                  type="number"
                  value={formData.tarifa_iva}
                  onChange={e => setFormData({ ...formData, tarifa_iva: parseFloat(e.target.value) || 0 })}
                  placeholder="19"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moneda">Moneda</Label>
                <select
                  id="moneda"
                  value={formData.moneda}
                  onChange={e => setFormData({ ...formData, moneda: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="COP">COP</option>
                  <option value="CUP">CUP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Cuenta del Jefe (Acceso completo)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jefe_nombre">Nombre *</Label>
                <Input
                  id="jefe_nombre"
                  value={formData.jefe_nombre}
                  onChange={e => setFormData({ ...formData, jefe_nombre: e.target.value })}
                  placeholder="Juan Pérez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jefe_email">Email *</Label>
                <Input
                  id="jefe_email"
                  type="email"
                  value={formData.jefe_email}
                  onChange={e => setFormData({ ...formData, jefe_email: e.target.value })}
                  placeholder="jefe@negocio.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jefe_password">Contraseña *</Label>
              <Input
                id="jefe_password"
                type="password"
                value={formData.jefe_password}
                onChange={e => setFormData({ ...formData, jefe_password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Roles Virtuales (Usuario / Contraseña)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['admin', 'comprador', 'vendedor'] as const).map(role => (
                <div key={role} className="space-y-2 p-3 bg-slate-50 rounded-lg">
                  <Label className="capitalize">{role}</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Usuario"
                      value={formData.roles[role].username}
                      onChange={e => setFormData({ ...formData, roles: { ...formData.roles, [role]: { ...formData.roles[role], username: e.target.value } } })}
                    />
                    <Input
                      type="password"
                      placeholder="Contraseña"
                      value={formData.roles[role].password}
                      onChange={e => setFormData({ ...formData, roles: { ...formData.roles, [role]: { ...formData.roles[role], password: e.target.value } } })}
                    />
                    <Input
                      placeholder="Nombre visible"
                      value={formData.roles[role].nombre}
                      onChange={e => setFormData({ ...formData, roles: { ...formData.roles, [role]: { ...formData.roles[role], nombre: e.target.value } } })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando negocio...
                </>
              ) : (
                'Crear negocio y cuentas'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}