import { LogOut, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/BusinessSelector';
import SyncIndicator from '@/components/SyncIndicator';

interface AppHeaderProps {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
}

/** Barra superior con tokens semánticos: toggle del sidebar, título, avatar y sync. */
export function AppHeader({ title, collapsed, onToggleCollapsed, onLogout }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 sm:h-16 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          className="hidden text-muted-foreground hover:text-foreground lg:inline-flex"
        >
          {collapsed ? <PanelLeft aria-hidden className="h-5 w-5" /> : <PanelLeftClose aria-hidden className="h-5 w-5" />}
        </Button>
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden text-xs capitalize text-muted-foreground md:block lg:text-sm">
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <UserAvatar />
        <SyncIndicator />
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="size-8 text-muted-foreground hover:text-foreground sm:size-9"
        >
          <LogOut aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </header>
  );
}
