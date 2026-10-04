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
        <SelectTrigger className="w-48 sm:w-56 h-9 bg-transparent border-slate-300 data-[state=open]:border-blue-500">
          <Building2 className="w-4 h-4 mr-2 text-slate-500" />
          <SelectValue placeholder="Seleccionar negocio" className="truncate" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={5}>
          {businesses.map(biz => (
            <SelectItem key={biz.id} value={biz.id} className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <div className="flex-1 text-left">
                <p className="font-medium truncate">{biz.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{biz.slug}</p>
              </div>
              {biz.is_owner && (
                <span title="Eres el dueño">
                  <Settings className="w-3 h-3 text-green-500" />
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión" className="h-9 w-9">
        <LogOut className="h-4 w-4" />
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

  const roleColors: Record<string, string> = {
    jefe: 'bg-purple-500',
    admin: 'bg-blue-500',
    comprador: 'bg-green-500',
    vendedor: 'bg-orange-500'
  }

  return (
    <div className="flex items-center gap-2 ml-2">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium', roleColors[user.role])}>
        {initials}
      </div>
      <div className="hidden sm:block text-left">
        <p className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{user.nombre}</p>
        <p className="text-xs text-slate-500 capitalize">{user.role}</p>
      </div>
    </div>
  )
}