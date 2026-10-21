import { useState } from 'react';
import { Menu, PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Section } from '@/types';
import type { NavMenuItem } from './nav-config';

/* ------------------------------------------------------------------ */
/* Ítem de navegación                                                  */
/* ------------------------------------------------------------------ */

interface NavItemProps {
  item: NavMenuItem;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
}

/**
 * Píldora de navegación: activa = bg-sidebar-primary (indigo) con barra
 * lateral de 3px anclada al borde; inactiva = sidebar-foreground con hover
 * en sidebar-accent. Colapsada: solo ícono centrado con tooltip.
 */
function NavItem({ item, active, collapsed, onSelect }: NavItemProps) {
  const Icon = item.icon;

  const button = (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        collapsed ? 'justify-center px-2' : 'px-3',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary"
        />
      )}
      <Icon
        aria-hidden
        className={cn(
          'h-5 w-5 shrink-0 transition-colors duration-150',
          active
            ? 'text-sidebar-primary-foreground'
            : 'text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground'
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle de colapso (dentro del sidebar)                              */
/* ------------------------------------------------------------------ */

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? 'Expandir menú' : 'Colapsar menú';

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-label={label}
      className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {collapsed ? <PanelLeft aria-hidden className="h-4 w-4" /> : <PanelLeftClose aria-hidden className="h-4 w-4" />}
    </Button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Contenido compartido (desktop y móvil renderizan el mismo markup)   */
/* ------------------------------------------------------------------ */

interface SidebarContentProps {
  activeSectionId: string;
  onSectionChange: (section: Section) => void;
  menuItems: NavMenuItem[];
  userName: string;
  /** Solo desktop: en móvil el Sheet siempre está expandido. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function SidebarContent({
  activeSectionId,
  onSectionChange,
  menuItems,
  userName,
  collapsed = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  return (
    <>
      {/* Marca del negocio */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 sm:h-16',
          collapsed && 'justify-center px-0'
        )}
      >
        <img
          src="/logo.png"
          alt="AdminNegocio Pro"
          className="h-9 w-9 shrink-0 object-contain"
        />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold tracking-tight text-sidebar-accent-foreground">
              AdminNegocio
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
              Pro
            </p>
          </div>
        )}
      </div>

      {/* Navegación por rol */}
      <nav aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item, index) => (
            <li
              key={item.id}
              className="animate-in fade-in-0 slide-in-from-left-2 fill-mode-backwards motion-reduce:animate-none"
              style={{ animationDelay: `${Math.min(index * 15, 240)}ms` }}
            >
              <NavItem
                item={item}
                active={activeSectionId === item.id}
                collapsed={collapsed}
                onSelect={() => onSectionChange({ id: item.id as Section['id'] })}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Pie: usuario + toggle de colapso */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-t border-sidebar-border p-3',
          collapsed && 'justify-center'
        )}
      >
        {!collapsed && (
          <div className="min-w-0 text-xs text-sidebar-foreground/60">
            <p className="truncate font-medium text-sidebar-foreground/80">{userName}</p>
            <p className="truncate">v1.0.0 · AdminNegocio Pro</p>
          </div>
        )}
        {onToggleCollapsed && (
          <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar de escritorio (rail colapsable)                             */
/* ------------------------------------------------------------------ */

export interface AppSidebarProps {
  activeSectionId: string;
  onSectionChange: (section: Section) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  menuItems: NavMenuItem[];
  userName: string;
}

/** Sidebar de escritorio: rail oscuro que transiciona entre w-64 y w-16. */
export function AppSidebar({
  activeSectionId,
  onSectionChange,
  collapsed,
  onToggleCollapsed,
  menuItems,
  userName,
}: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <SidebarContent
        activeSectionId={activeSectionId}
        onSectionChange={onSectionChange}
        menuItems={menuItems}
        userName={userName}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar móvil (Sheet, siempre expandido)                            */
/* ------------------------------------------------------------------ */

export interface MobileSidebarProps {
  activeSectionId: string;
  onSectionChange: (section: Section) => void;
  menuItems: NavMenuItem[];
  userName: string;
}

/** Sidebar móvil: Sheet lateral con el mismo contenido, siempre expandido. */
export function MobileSidebar({
  activeSectionId,
  onSectionChange,
  menuItems,
  userName,
}: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir menú de navegación"
          className="lg:hidden"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 gap-0 border-sidebar-border bg-sidebar text-sidebar-foreground sm:w-72"
      >
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <SheetDescription className="sr-only">
          Secciones de AdminNegocio Pro
        </SheetDescription>
        <SidebarContent
          activeSectionId={activeSectionId}
          onSectionChange={(section) => {
            onSectionChange(section);
            setOpen(false);
          }}
          menuItems={menuItems}
          userName={userName}
        />
      </SheetContent>
    </Sheet>
  );
}
