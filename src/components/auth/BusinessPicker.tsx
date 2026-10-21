import { Building2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Business } from '@/contexts/BusinessContext'
import { LoginForm, type LoginFormValues } from './LoginForm'
import { cn } from '@/lib/utils'

interface BusinessPickerProps {
  businesses: Business[]
  selectedBusinessId: string | null
  onSelectBusiness: (id: string) => void
  onBack: () => void
  onOpenOnboarding: () => void
  loginValues: LoginFormValues
  onLoginChange: (field: keyof LoginFormValues, value: string) => void
  onLoginSubmit: (event: React.FormEvent) => void
  loginLoading: boolean
  loginError: string | null
}

/** Selector de negocios con login incrustado al elegir uno. */
export function BusinessPicker({
  businesses,
  selectedBusinessId,
  onSelectBusiness,
  onBack,
  onOpenOnboarding,
  loginValues,
  onLoginChange,
  onLoginSubmit,
  loginLoading,
  loginError,
}: BusinessPickerProps) {
  return (
    <Card className="rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="text-center">
        <Building2 className="mx-auto mb-3 size-12 text-primary" aria-hidden />
        <CardTitle>Selecciona tu Negocio</CardTitle>
        <CardDescription>Elige el negocio al que quieres acceder</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {businesses.map((biz) => (
          <Button
            key={biz.id}
            variant="outline"
            aria-pressed={selectedBusinessId === biz.id}
            className={cn(
              'h-auto w-full justify-start gap-3 py-3',
              selectedBusinessId === biz.id && 'border-primary/40 bg-primary/5',
            )}
            onClick={() => onSelectBusiness(biz.id)}
          >
            <Building2 className="size-5" aria-hidden />
            <div className="text-left">
              <p className="font-medium">{biz.nombre}</p>
              <p className="text-xs text-muted-foreground">{biz.slug}</p>
            </div>
          </Button>
        ))}

        {selectedBusinessId && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                Iniciar sesión en:{' '}
                <span className="text-primary">
                  {businesses.find((b) => b.id === selectedBusinessId)?.nombre}
                </span>
              </h3>
              <Button variant="ghost" size="sm" onClick={onBack}>
                Volver
              </Button>
            </div>

            <LoginForm
              values={loginValues}
              onChange={onLoginChange}
              onSubmit={onLoginSubmit}
              loading={loginLoading}
              error={loginError}
            />
          </div>
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            ¿No aparece tu negocio?
          </p>
          <Button
            variant="outline"
            className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={onOpenOnboarding}
          >
            <Plus className="size-4" aria-hidden />
            Registrar nuevo negocio
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
