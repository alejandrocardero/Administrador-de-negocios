import { useState } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users,
  Receipt, TrendingUp, Settings, Menu, LogOut, ClipboardCheck, Wallet, HandCoins, CalendarCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Section } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { UserAvatar } from '@/components/BusinessSelector';

import Dashboard from '@/sections/Dashboard';
import Inventario from '@/sections/Inventario';
import Ventas from '@/sections/Ventas';
import Vendedores from '@/sections/Vendedores';
import Compradores from '@/sections/Compradores';
import Compras from '@/sections/Compras';
import Gastos from '@/sections/Gastos';
import Impuestos from '@/sections/Impuestos';
import Reportes from '@/sections/Reportes';
import Configuracion from '@/sections/Configuracion';
import Pedidos from '@/sections/Pedidos';
import VerCompradores from '@/sections/VerCompradores';
import AlertaStock from '@/sections/AlertaStock';
import HacerCompras from '@/sections/HacerCompras';
import AprobarProductos from '@/sections/AprobarProductos';
import Salarios from '@/sections/Salarios';
import ReporteVentaDiaria from '@/sections/ReporteVentaDiaria';
import Fiados from '@/sections/Fiados';
import AvisoFiados from '@/components/AvisoFiados';

import { BusinessLanding, OnboardingDialog } from '@/components/auth/BusinessLanding';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const menuItemsJefe: MenuItem[] = [
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
];

const menuItemsAdmin: MenuItem[] = [
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'vendedores', label: 'Vendedores', icon: Users },
  { id: 'compradores', label: 'Compradores', icon: Users },
  { id: 'pedidos', label: 'Pedidos', icon: Package },
  { id: 'aprobarProductos', label: 'Nuevos Productos', icon: ClipboardCheck },
  { id: 'fiados', label: 'Fiados', icon: HandCoins },
];

const menuItemsVendedor: MenuItem[] = [
  { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
  { id: 'pedidos', label: 'Pedidos', icon: Package },
  { id: 'fiados', label: 'Fiados', icon: HandCoins },
];

const menuItemsComprador: MenuItem[] = [
  { id: 'compradores', label: 'Compradores', icon: Users },
  { id: 'compras', label: 'Realizar Compras', icon: Receipt },
  { id: 'alertaStock', label: 'Alerta Stock', icon: Package },
  { id: 'fiados', label: 'Fiados', icon: HandCoins },
];

function Sidebar({ 
  activeSectionId, 
  onSectionChange,
  collapsed = false,
  menuItems,
  userName
}: { 
  activeSectionId: string; 
  onSectionChange: (section: Section) => void;
  collapsed?: boolean;
  menuItems: MenuItem[];
  userName: string;
}) {
  return (
    <div className={cn(
      "flex flex-col h-full bg-slate-900 text-white transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-center h-14 sm:h-16 border-b border-slate-700 px-2">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
            />
            <span className="font-bold text-base sm:text-lg hidden sm:block">AdminNegocio</span>
          </div>
        )}
        {collapsed && (
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
          />
        )}
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSectionId === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange({ id: item.id as Section['id'] })}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                    isActive 
                      ? "bg-blue-600 text-white" 
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
                  {!collapsed && <span className="hidden sm:block">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-3 sm:p-4 border-t border-slate-700">
        {!collapsed && (
          <div className="text-xs text-slate-400 text-center">
            <p className="truncate">{userName}</p>
            <p className="hidden sm:block">v1.0.0 - AdminNegocio Pro</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileSidebar({ 
  activeSectionId, 
  onSectionChange,
  menuItems,
  userName
}: { 
  activeSectionId: string; 
  onSectionChange: (section: Section) => void;
  menuItems: MenuItem[];
  userName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 sm:w-72">
        <div className="flex flex-col h-full bg-slate-900 text-white">
          <div className="flex items-center justify-center h-14 sm:h-16 border-b border-slate-700 px-2">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="font-bold text-lg">AdminNegocio</span>
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSectionId === item.id;
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onSectionChange({ id: item.id as Section['id'] });
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                        isActive 
                          ? "bg-blue-600 text-white" 
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          
          <div className="p-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 text-center">
              <p className="truncate">{userName}</p>
              <p>v1.0.0 - AdminNegocio Pro</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Header({ 
  title, 
  onMenuClick,
  onLogout
}: { 
  title: string; 
  onMenuClick: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="hidden lg:flex">
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-none">{title}</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
          <span className="text-xs lg:text-sm">{new Date().toLocaleDateString('es-CO', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })}</span>
        </div>
        <UserAvatar />
        <Button variant="ghost" size="icon" onClick={onLogout} title="Cerrar sesión" className="h-8 w-8 sm:h-9 sm:w-9">
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </header>
  );
}

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { loading: bizLoading } = useBusiness();
  const [activeSection, setActiveSection] = useState<Section>({ id: 'dashboard' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const bumpDataVersion = () => {
    setDataVersion(v => v + 1);
  };

  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);

  // Si hay auth loading -> mostrar loading
  if (authLoading || bizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si no hay usuario logueado -> mostrar BusinessLanding (selector de negocios o registro)
  if (!user) {
    return (
      <>
        <BusinessLanding onOpenOnboarding={() => setShowOnboardingDialog(true)} />
        <OnboardingDialog open={showOnboardingDialog} onOpenChange={setShowOnboardingDialog} />
      </>
    );
  }

  const menuItems = user.role === 'vendedor' ? menuItemsVendedor : 
                    user.role === 'admin' ? menuItemsAdmin :
                    user.role === 'comprador' ? menuItemsComprador : menuItemsJefe;
  
  if (!menuItems.find(item => item.id === activeSection.id)) {
    setActiveSection({ id: menuItems[0].id as Section['id'] });
  }

  const renderSection = () => {
    // 'reporteDiario' existe solo en el menú del jefe; se amplía el tipo del
    // switch porque Section (src/types) no fue modificado por scope.
    switch (activeSection.id as Section['id'] | 'reporteDiario') {
      case 'dashboard':
        return user.role === 'jefe' ? <Dashboard onSectionChange={setActiveSection} /> : <Ventas />;
      case 'inventario':
        return <Inventario />;
      case 'ventas':
        return <Ventas />;
      case 'vendedores':
        return (user.role === 'jefe' || user.role === 'admin') ? <Vendedores /> : null;
      case 'compradores':
        return user.role === 'comprador' ? <VerCompradores /> : <Compradores />;
      case 'pedidos':
        return <Pedidos user={user} />;
      case 'compras':
        return user.role === 'comprador' ? <HacerCompras /> : <Compras />;
      case 'gastos':
        return user.role === 'jefe' ? <Gastos /> : null;
      case 'impuestos':
        return user.role === 'jefe' ? <Impuestos /> : null;
      case 'reportes':
        return user.role === 'jefe' ? <Reportes initialFilters={activeSection.params} /> : null;
      case 'reporteDiario':
        return user.role === 'jefe' ? <ReporteVentaDiaria /> : null;
      case 'configuracion':
        return user.role === 'jefe' ? <Configuracion /> : null;
      case 'alertaStock':
        return user.role === 'comprador' ? <AlertaStock /> : null;
      case 'salarios':
        return user.role === 'jefe' ? <Salarios /> : null;
      case 'aprobarProductos':
        return (user.role === 'admin' || user.role === 'jefe') ? <AprobarProductos /> : null;
      case 'fiados':
        return <Fiados />;
      default:
        return <Ventas />;
    }
  };

  const activeItem = menuItems.find(item => item.id === activeSection.id);

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar 
          activeSectionId={activeSection.id} 
          onSectionChange={setActiveSection}
          collapsed={sidebarCollapsed}
          menuItems={menuItems}
          userName={user.nombre}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 lg:hidden px-4 py-3 bg-white border-b border-slate-200">
          <MobileSidebar 
            activeSectionId={activeSection.id} 
            onSectionChange={setActiveSection}
            menuItems={menuItems}
            userName={user.nombre}
          />
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-8 h-8 object-contain"
          />
          <span className="font-semibold text-lg">AdminNegocio</span>
        </div>
        
        <Header 
          title={activeItem?.label || 'Ventas'} 
          onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={logout}
        />

        <main key={dataVersion} className="flex-1 overflow-auto p-4 lg:p-6">
          {renderSection()}
        </main>
      </div>

      <AvisoFiados onCobrado={bumpDataVersion} />
    </div>
  );
}