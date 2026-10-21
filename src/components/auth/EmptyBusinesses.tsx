import { Building2, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthShell } from './AuthShell'
import { EmptyState } from '@/components/shared'

interface EmptyBusinessesProps {
  onOpenOnboarding: () => void
}

/** Vista cuando aún no existe ningún negocio registrado. */
export function EmptyBusinesses({ onOpenOnboarding }: EmptyBusinessesProps) {
  return (
    <AuthShell>
      <div className="w-full max-w-2xl">
        <Card className="rounded-xl border-border bg-card shadow-sm">
          <CardContent className="py-10">
            <EmptyState
              icon={Building2}
              title="No hay negocios registrados"
              description="Para comenzar, registra tu primer negocio"
              action={
                <Button size="lg" className="w-full gap-2 sm:w-auto" onClick={onOpenOnboarding}>
                  <Plus className="size-5" aria-hidden />
                  Registrar mi negocio
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  )
}
