import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LabeledInput } from '@/components/shared'

export interface LoginFormValues {
  identifier: string
  password: string
}

interface LoginFormProps {
  values: LoginFormValues
  onChange: (field: keyof LoginFormValues, value: string) => void
  onSubmit: (event: React.FormEvent) => void
  loading: boolean
  error: string | null
}

/** Formulario de acceso compartido: usuario/email + contraseña, con error global y estado de carga. */
export function LoginForm({ values, onChange, onSubmit, loading, error }: LoginFormProps) {
  return (
    <>
      {error && (
        <Alert variant="destructive" className="text-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <LabeledInput
          label="Usuario / Email"
          type="text"
          value={values.identifier}
          onChange={(e) => onChange('identifier', e.target.value)}
          placeholder="usuario o email@dominio.com"
          required
          autoComplete="username"
          disabled={loading}
        />
        <LabeledInput
          label="Contraseña"
          type="password"
          value={values.password}
          onChange={(e) => onChange('password', e.target.value)}
          placeholder="Tu contraseña"
          required
          autoComplete="current-password"
          disabled={loading}
        />
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {loading ? 'Entrando...' : 'Iniciar sesión'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Jefe: usa tu email
        <br />
        Admin/Comprador/Vendedor: usa tu usuario (ej: admin, comprador, vendedor)
      </p>
    </>
  )
}
