import { useState } from 'react'
import { useBusiness } from '@/contexts/BusinessContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { LabeledInput } from '@/components/shared'

interface OnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Diálogo de registro de negocio nuevo + cuentas de acceso por rol. */
export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Datos del Negocio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LabeledInput
                id="nombre"
                label="Nombre del Negocio *"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: La Prodigiosa"
                required
              />
              <LabeledInput
                id="slug"
                label="Slug (URL) *"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="la-prodigiosa"
                required
              />
              <LabeledInput
                id="nit"
                label="NIT"
                value={formData.nit}
                onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                placeholder="123456789"
              />
              <LabeledInput
                id="direccion"
                label="Dirección"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Dirección completa"
              />
              <LabeledInput
                id="telefono"
                label="Teléfono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="3001234567"
              />
              <LabeledInput
                id="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@negocio.com"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Configuración Fiscal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex w-full flex-col gap-1.5">
                <label htmlFor="regimen" className="text-sm font-medium">
                  Régimen
                </label>
                <Select
                  value={formData.regimen}
                  onValueChange={(value) => setFormData({ ...formData, regimen: value })}
                >
                  <SelectTrigger id="regimen" className="w-full">
                    <SelectValue placeholder="Selecciona el régimen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simplificado">Simplificado</SelectItem>
                    <SelectItem value="comun">Común</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <LabeledInput
                id="tarifa_iva"
                label="Tarifa IVA %"
                type="number"
                value={formData.tarifa_iva}
                onChange={(e) => setFormData({ ...formData, tarifa_iva: parseFloat(e.target.value) || 0 })}
                placeholder="19"
              />
              <div className="flex w-full flex-col gap-1.5">
                <label htmlFor="moneda" className="text-sm font-medium">
                  Moneda
                </label>
                <Select
                  value={formData.moneda}
                  onValueChange={(value) => setFormData({ ...formData, moneda: value })}
                >
                  <SelectTrigger id="moneda" className="w-full">
                    <SelectValue placeholder="Selecciona la moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COP">COP</SelectItem>
                    <SelectItem value="CUP">CUP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Cuenta del Jefe (Acceso completo)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LabeledInput
                id="jefe_nombre"
                label="Nombre *"
                value={formData.jefe_nombre}
                onChange={(e) => setFormData({ ...formData, jefe_nombre: e.target.value })}
                placeholder="Juan Pérez"
                required
              />
              <LabeledInput
                id="jefe_email"
                label="Email *"
                type="email"
                value={formData.jefe_email}
                onChange={(e) => setFormData({ ...formData, jefe_email: e.target.value })}
                placeholder="jefe@negocio.com"
                required
              />
            </div>
            <LabeledInput
              id="jefe_password"
              label="Contraseña *"
              type="password"
              value={formData.jefe_password}
              onChange={(e) => setFormData({ ...formData, jefe_password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Roles Virtuales (Usuario / Contraseña)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['admin', 'comprador', 'vendedor'] as const).map((role) => (
                <div key={role} className="space-y-2 rounded-lg bg-muted/50 p-3">
                  <Label className="capitalize">{role}</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Usuario"
                      aria-label={`Usuario de ${role}`}
                      value={formData.roles[role].username}
                      onChange={(e) => setFormData({ ...formData, roles: { ...formData.roles, [role]: { ...formData.roles[role], username: e.target.value } } })}
                    />
                    <Input
                      type="password"
                      placeholder="Contraseña"
                      aria-label={`Contraseña de ${role}`}
                      value={formData.roles[role].password}
                      onChange={(e) => setFormData({ ...formData, roles: { ...formData.roles, [role]: { ...formData.roles[role], password: e.target.value } } })}
                    />
                    <Input
                      placeholder="Nombre visible"
                      aria-label={`Nombre visible de ${role}`}
                      value={formData.roles[role].nombre}
                      onChange={(e) => setFormData({ ...formData, roles: { ...formData.roles, [role]: { ...formData.roles[role], nombre: e.target.value } } })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
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
