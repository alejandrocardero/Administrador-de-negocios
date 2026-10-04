import { useState } from 'react'
import { useBusiness } from '@/contexts/BusinessContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 1 | 2

interface BusinessFormData {
  nombre: string
  slug: string
  nit: string
  direccion: string
  telefono: string
  email: string
  regimen: 'simplificado' | 'comun'
  tarifa_iva: number
  moneda: string
}

interface RolesFormData {
  admin: { username: string; password: string; nombre: string }
  comprador: { username: string; password: string; nombre: string }
  vendedor: { username: string; password: string; nombre: string }
}

interface JefeFormData {
  nombre: string
  email: string
  password: string
  confirmPassword: string
}

export function OnboardingWizard() {
  const { createBusiness } = useBusiness()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [businessData, setBusinessData] = useState<BusinessFormData>({
    nombre: '',
    slug: '',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
    regimen: 'simplificado',
    tarifa_iva: 19,
    moneda: 'COP'
  })

  const [jefeData, setJefeData] = useState<JefeFormData>({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [rolesData, setRolesData] = useState<RolesFormData>({
    admin: { username: 'admin', password: '', nombre: 'Administrador' },
    comprador: { username: 'comprador', password: '', nombre: 'Comprador' },
    vendedor: { username: 'vendedor', password: '', nombre: 'Vendedor' }
  })

  const validateStep1 = () => {
    if (!businessData.nombre.trim()) return 'Nombre del negocio es obligatorio'
    if (!businessData.slug.trim()) return 'Nombre corto (slug) es obligatorio'
    if (!/^[a-z0-9-]{3,50}$/.test(businessData.slug)) return 'Slug debe tener 3-50 caracteres: letras minúsculas, números y guiones'
    if (!jefeData.nombre.trim()) return 'Nombre del jefe es obligatorio'
    if (!jefeData.email.trim()) return 'Email del jefe es obligatorio'
    if (!jefeData.password) return 'Contraseña es obligatoria'
    if (jefeData.password.length < 6) return 'Contraseña debe tener al menos 6 caracteres'
    if (jefeData.password !== jefeData.confirmPassword) return 'Las contraseñas no coinciden'
    return null
  }

  const validateStep2 = () => {
    const usernames = new Set<string>()
    for (const [role, data] of Object.entries(rolesData)) {
      if (!data.username.trim()) return `Usuario para ${role} es obligatorio`
      if (!data.password) return `Contraseña para ${role} es obligatoria`
      if (data.password.length < 6) return `Contraseña para ${role} debe tener al menos 6 caracteres`
      if (!data.nombre.trim()) return `Nombre para ${role} es obligatorio`
      if (usernames.has(data.username)) return `Usuario "${data.username}" ya está en uso`
      usernames.add(data.username)
    }
    // Verificar que no coincidan con 'jefe'
    if (usernames.has('jefe')) return 'El usuario "jefe" está reservado'
    return null
  }

  const handleNext = async () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) return setError(err)
      setStep(2)
      setError(null)
    } else {
      const err = validateStep2()
      if (err) return setError(err)

      setLoading(true)
      setError(null)

      const result = await createBusiness({
        ...businessData,
        jefe_nombre: jefeData.nombre,
        jefe_email: jefeData.email,
        jefe_password: jefeData.password,
        roles: rolesData
      })

      setLoading(false)

      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error || 'Error al crear el negocio')
      }
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      setError(null)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Negocio creado!</h2>
            <p className="text-slate-600 mb-6">
              Tu negocio <strong>{businessData.nombre}</strong> ha sido registrado correctamente.
              Las credenciales para los 4 roles han sido creadas.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Ir al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Registrar mi Negocio</h1>
          <p className="mt-2 text-slate-600">
            Paso {step} de 2: {step === 1 ? 'Datos del Negocio y Jefe' : 'Credenciales de Roles'}
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium',
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500')}>1</div>
            <div className={cn('w-16 h-1 mx-2', step >= 2 ? 'bg-blue-600' : 'bg-slate-200')} />
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium',
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500')}>2</div>
          </div>
        </div>

        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{step === 1 ? 'Datos del Negocio y Jefe' : 'Credenciales de los 3 Roles'}</CardTitle>
            <CardDescription>
              {step === 1
                ? 'Información básica de tu negocio y tu cuenta de jefe (dueño)'
                : 'Define usuario y contraseña para cada rol. El jefe ya tiene su cuenta con email.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-medium text-slate-900 mb-4">Información del Negocio</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del Negocio *</Label>
                      <Input
                        id="nombre"
                        value={businessData.nombre}
                        onChange={e => setBusinessData({ ...businessData, nombre: e.target.value })}
                        placeholder="Mi Tienda"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Nombre Corto (Slug) *</Label>
                      <Input
                        id="slug"
                        value={businessData.slug}
                        onChange={e => setBusinessData({ ...businessData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="mi-tienda"
                      />
                      <p className="text-xs text-muted-foreground">Solo letras minúsculas, números y guiones. Para subdominio futuro.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nit">NIT</Label>
                      <Input
                        id="nit"
                        value={businessData.nit}
                        onChange={e => setBusinessData({ ...businessData, nit: e.target.value })}
                        placeholder="900.123.456-7"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regimen">Régimen Fiscal</Label>
                      <select
                        id="regimen"
                        value={businessData.regimen}
                        onChange={e => setBusinessData({ ...businessData, regimen: e.target.value as 'simplificado' | 'comun' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="simplificado">Simplificado</option>
                        <option value="comun">Común</option>
                      </select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="direccion">Dirección</Label>
                      <Input
                        id="direccion"
                        value={businessData.direccion}
                        onChange={e => setBusinessData({ ...businessData, direccion: e.target.value })}
                        placeholder="Calle 123 #45-67"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono</Label>
                      <Input
                        id="telefono"
                        value={businessData.telefono}
                        onChange={e => setBusinessData({ ...businessData, telefono: e.target.value })}
                        placeholder="+57 300 123 4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email del Negocio</Label>
                      <Input
                        id="email"
                        type="email"
                        value={businessData.email}
                        onChange={e => setBusinessData({ ...businessData, email: e.target.value })}
                        placeholder="contacto@mitienda.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tarifa_iva">Tarifa IVA %</Label>
                      <Input
                        id="tarifa_iva"
                        type="number"
                        step="0.01"
                        value={businessData.tarifa_iva}
                        onChange={e => setBusinessData({ ...businessData, tarifa_iva: parseFloat(e.target.value) || 19 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="moneda">Moneda</Label>
                      <Input
                        id="moneda"
                        value={businessData.moneda}
                        onChange={e => setBusinessData({ ...businessData, moneda: e.target.value.toUpperCase() })}
                        placeholder="COP"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-medium text-slate-900 mb-4">Cuenta del Jefe (Dueño)</h3>
                  <p className="text-sm text-slate-500 mb-4">Esta cuenta usa email y contraseña. Tendrá acceso completo al negocio.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="jefe_nombre">Nombre Completo *</Label>
                      <Input
                        id="jefe_nombre"
                        value={jefeData.nombre}
                        onChange={e => setJefeData({ ...jefeData, nombre: e.target.value })}
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jefe_email">Email *</Label>
                      <Input
                        id="jefe_email"
                        type="email"
                        value={jefeData.email}
                        onChange={e => setJefeData({ ...jefeData, email: e.target.value })}
                        placeholder="juan@ejemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jefe_password">Contraseña *</Label>
                      <Input
                        id="jefe_password"
                        type="password"
                        value={jefeData.password}
                        onChange={e => setJefeData({ ...jefeData, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jefe_confirmPassword">Confirmar Contraseña *</Label>
                      <Input
                        id="jefe_confirmPassword"
                        type="password"
                        value={jefeData.confirmPassword}
                        onChange={e => setJefeData({ ...jefeData, confirmPassword: e.target.value })}
                        placeholder="Repetir contraseña"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <p className="text-sm text-slate-500">
                  Define credenciales para los 3 roles operativos. El jefe usará su email/contraseña.
                  Estos usuarios entrarán con <strong>usuario/contraseña</strong> (sin email).
                </p>

                {(['admin', 'comprador', 'vendedor'] as const).map(role => (
                  <div key={role} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h4 className="font-medium text-slate-900 mb-4 capitalize">{role}</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`${role}_username`}>Usuario *</Label>
                        <Input
                          id={`${role}_username`}
                          value={rolesData[role].username}
                          onChange={e => setRolesData({ ...rolesData, [role]: { ...rolesData[role], username: e.target.value } })}
                          placeholder={`usuario_${role}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${role}_password`}>Contraseña *</Label>
                        <Input
                          id={`${role}_password`}
                          type="password"
                          value={rolesData[role].password}
                          onChange={e => setRolesData({ ...rolesData, [role]: { ...rolesData[role], password: e.target.value } })}
                          placeholder="Mínimo 4 caracteres"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${role}_nombre`}>Nombre Visible *</Label>
                        <Input
                          id={`${role}_nombre`}
                          value={rolesData[role].nombre}
                          onChange={e => setRolesData({ ...rolesData, [role]: { ...rolesData[role], nombre: e.target.value } })}
                          placeholder={rolesData[role].nombre}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1 || loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Atrás
              </Button>
              <Button onClick={handleNext} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {step === 1 ? 'Siguiente' : 'Crear Negocio'}
                  </>
                ) : step === 1 ? (
                  <>
                    Siguiente
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  'Crear Negocio'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}