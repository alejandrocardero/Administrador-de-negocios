import { useBusiness } from '@/contexts/BusinessContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BusinessSelector() {
  const { businesses, currentBusiness, switchBusiness, loading } = useBusiness()
  const { logout } = useAuth()

  if (loading || businesses.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <Select value={currentBusiness?.id || ''} onValueChange={switchBusiness}>
        <SelectTrigger className="h-9 w-48 border-input bg-transparent sm:w-56 data-[state=open]:border-ring">
          <Building2 className="mr-2 size-4 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="Seleccionar negocio" className="truncate" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={5}>
          {businesses.map(biz => (
            <SelectItem key={biz.id} value={biz.id} className="flex items-center gap-2">
              <Building2 className="size-4" aria-hidden />
              <div className="flex-1 text-left">
                <p className="truncate font-medium">{biz.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{biz.slug}</p>
              </div>
              {biz.is_owner && (
                <span title="Eres el dueño">
                  <Settings className="size-3 text-success" aria-hidden />
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión" className="h-9 w-9">
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  )
}

export function UserAvatar() {
  const { user } = useAuth()

  if (!user) return null

  const initials = user.nombre
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Tonos suaves del sistema: jefe (marca), comprador (éxito),
  // vendedor (advertencia/ámbar), resto en neutro.
  const roleColors: Record<string, string> = {
    jefe: 'bg-primary/15 text-primary',
    admin: 'bg-muted text-muted-foreground',
    comprador: 'bg-success/15 text-success',
    vendedor: 'bg-warning/15 text-warning-foreground'
  }

  return (
    <div className="ml-2 flex items-center gap-2">
      <div className={cn('flex size-8 items-center justify-center rounded-full text-sm font-medium', roleColors[user.role] ?? 'bg-muted text-muted-foreground')}>
        {initials}
      </div>
      <div className="hidden text-left sm:block">
        <p className="max-w-[120px] truncate text-sm font-medium text-foreground">{user.nombre}</p>
        <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
      </div>
    </div>
  )
}
