import type { ElementType } from 'react';
import {
  CalendarCheck,
  ClipboardCheck,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { UserRole } from '@/types';

/** Ítem de navegación del sidebar. */
export interface NavMenuItem {
  id: string;
  label: string;
  icon: ElementType;
}

/**
 * Menús por rol — mismos ids, labels e iconos que consumía App.tsx.
 * Los ids deben coincidir con el switch de renderSection().
 */
export const NAV_BY_ROLE: Record<UserRole, NavMenuItem[]> = {
  jefe: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'vendedores', label: 'Vendedores', icon: Users },
    { id: 'compradores', label: 'Compradores', icon: Users },
    { id: 'compras', label: 'Compras', icon: Receipt },
    { id: 'gastos', label: 'Gastos', icon: Receipt },
    { id: 'impuestos', label: 'Impuestos', icon: Receipt },
    { id: 'salarios', label: 'Salarios', icon: Wallet },
    { id: 'reportes', label: 'Reportes', icon: TrendingUp },
    { id: 'reporteDiario', label: 'Reporte Venta Diaria', icon: CalendarCheck },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
    { id: 'aprobarProductos', label: 'Nuevos Productos', icon: ClipboardCheck },
    { id: 'fiados', label: 'Fiados', icon: HandCoins },
  ],
  admin: [
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'vendedores', label: 'Vendedores', icon: Users },
    { id: 'compradores', label: 'Compradores', icon: Users },
    { id: 'pedidos', label: 'Pedidos', icon: Package },
    { id: 'aprobarProductos', label: 'Nuevos Productos', icon: ClipboardCheck },
    { id: 'fiados', label: 'Fiados', icon: HandCoins },
  ],
  vendedor: [
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'pedidos', label: 'Pedidos', icon: Package },
    { id: 'fiados', label: 'Fiados', icon: HandCoins },
  ],
  comprador: [
    { id: 'compradores', label: 'Compradores', icon: Users },
    { id: 'compras', label: 'Realizar Compras', icon: Receipt },
    { id: 'alertaStock', label: 'Alerta Stock', icon: Package },
    { id: 'fiados', label: 'Fiados', icon: HandCoins },
  ],
};

/** Devuelve el menú correspondiente al rol del usuario autenticado. */
export function getNavForRole(role: UserRole): NavMenuItem[] {
  return NAV_BY_ROLE[role];
}
