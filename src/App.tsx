import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Section } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';

import Dashboard from '@/sections/Dashboard';
import Inventario from '@/sections/Inventario';
import Ventas from '@/sections/Ventas';
import Vendedores from '@/sections/Vendedores';
import Compradores from '@/sections/Compradores';
import Compras from '@/sections/Compras';
import Gastos from '@/sections/Gastos';
import Impuestos from '@/sections/Impuestos';
import ConflictResolver from '@/components/ConflictResolver';
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
import AvisoPedidos from '@/components/AvisoPedidos';
import AvisoSolicitudes from '@/components/AvisoSolicitudes';

import { BusinessLanding, OnboardingDialog } from '@/components/auth/BusinessLanding';
import { AppSidebar, MobileSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { getNavForRole } from '@/components/layout/nav-config';

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { loading: bizLoading } = useBusiness();
  const [activeSection, setActiveSection] = useState<Section>({ id: 'dashboard' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);

  const bumpDataVersion = () => {
    setDataVersion(v => v + 1);
  };

  const menuItems = user ? getNavForRole(user.role) : [];

  // Si la sección activa no existe en el menú del rol actual (p. ej. al cambiar
  // de sesión), se corrige en un efecto — nunca con setState durante el render.
  useEffect(() => {
    if (menuItems.length > 0 && !menuItems.find(item => item.id === activeSection.id)) {
      setActiveSection({ id: menuItems[0].id as Section['id'] });
    }
  }, [menuItems, activeSection.id]);

  // Si hay auth loading -> mostrar loading
  if (authLoading || bizLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <img src="/logo.png" alt="AdminNegocio Pro" className="h-14 w-14 object-contain" />
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando tu negocio…</p>
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

  const toggleSidebar = () => setSidebarCollapsed(v => !v);

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
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <AppSidebar
          activeSectionId={activeSection.id}
          onSectionChange={setActiveSection}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          menuItems={menuItems}
          userName={user.nombre}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra de marca móvil (el sidebar vive en un Sheet) */}
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3 lg:hidden">
          <MobileSidebar
            activeSectionId={activeSection.id}
            onSectionChange={setActiveSection}
            menuItems={menuItems}
            userName={user.nombre}
          />
          <img src="/logo.png" alt="AdminNegocio Pro" className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold tracking-tight text-foreground">AdminNegocio</span>
        </div>

        <AppHeader
          title={activeItem?.label || 'Ventas'}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          onLogout={logout}
        />

        <ConflictResolver />

        <main key={dataVersion} className="flex-1 overflow-auto p-4 lg:p-6">
          {renderSection()}
        </main>
      </div>

      <AvisoFiados onCobrado={bumpDataVersion} />
      {(user.role === 'admin' || user.role === 'jefe') && (
        <>
          <AvisoPedidos onProcesar={bumpDataVersion} />
          <AvisoSolicitudes onProcesar={bumpDataVersion} />
        </>
      )}
    </div>
  );
}
