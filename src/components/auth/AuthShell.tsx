import type { ReactNode } from 'react'
import { Loader2, Building2 } from 'lucide-react'

/** Pantalla de carga a ancho completo con tokens semánticos. */
export function AuthLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
    </div>
  )
}

interface AuthShellProps {
  /** Acción opcional a la derecha de la cabecera (ej. desbloquear SuperAdmin). */
  headerAction?: ReactNode
  children: ReactNode
}

/** Layout de autenticación: cabecera de marca + área central con degradado sutil de marca. */
export function AuthShell({ headerAction, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Degradado sutil de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/5 to-transparent"
      />

      <header className="relative border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Building2 className="size-6" aria-hidden />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">
                AdminNegocio Pro
              </span>
            </div>
            {headerAction}
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  )
}
