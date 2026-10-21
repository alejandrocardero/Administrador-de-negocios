import { Building2, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Business } from '@/contexts/BusinessContext'
import { LoginForm, type LoginFormValues } from './LoginForm'

interface LockedBusinessLoginProps {
  business: Business
  values: LoginFormValues
  onChange: (field: keyof LoginFormValues, value: string) => void
  onSubmit: (event: React.FormEvent) => void
  loading: boolean
  error: string | null
}

/** Dispositivo bloqueado a un negocio: acceso directo solo a ese negocio. */
export function LockedBusinessLogin({
  business,
  values,
  onChange,
  onSubmit,
  loading,
  error,
}: LockedBusinessLoginProps) {
  return (
    <Card className="rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Building2 className="size-10 text-primary" aria-hidden />
          <Lock className="size-5 text-warning" aria-hidden />
        </div>
        <CardTitle>Acceso a {business.nombre}</CardTitle>
        <CardDescription>
          Este dispositivo está configurado para {business.nombre}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm
          values={values}
          onChange={onChange}
          onSubmit={onSubmit}
          loading={loading}
          error={error}
        />
      </CardContent>
    </Card>
  )
}
