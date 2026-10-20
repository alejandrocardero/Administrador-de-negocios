import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { subDays } from 'date-fns';
import ReporteVentaDiaria from '../ReporteVentaDiaria';

// Estado mutable compartido con los mocks (vi.hoisted para que los factories
// de vi.mock puedan referenciarlo).
const mockState = vi.hoisted(() => ({
  user: { role: 'jefe', nombre: 'Jefe Principal' },
  ventas: [] as Array<Record<string, unknown>>,
  registros: [] as Array<Record<string, unknown>>,
  productos: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/hooks/supabase/useSupabaseData', () => ({
  useVentasDiarias: () => ({
    loading: false,
    getVentasByFecha: (inicio: string, _fin: string) =>
      mockState.ventas.filter(v => String(v.fecha).slice(0, 10) === inicio.slice(0, 10)),
  }),
  useRegistrosIPVE: () => ({
    getRegistrosByFecha: (fecha: string) =>
      mockState.registros.filter(r => r.fecha === fecha && r.tipo === 'historico'),
  }),
  useProductos: () => ({
    loading: false,
    data: mockState.productos,
    getById: (id: string) => mockState.productos.find(p => p.id === id),
  }),
  formatCurrency: (n: number) => '$' + n.toLocaleString('es-CO'),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockState.user, loading: false }),
}));

/** Misma construcción de fecha local que usa la sección (YYYY-MM-DD). */
function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const hoy = new Date();
const hoyStr = fechaLocal(hoy);
const semanaStr = fechaLocal(subDays(hoy, 7));

function venta(fecha: string, totalVendido: number, salarioCalculado: number) {
  return {
    id: `venta-${fecha}-${totalVendido}`,
    fecha: `${fecha}T15:00:00.000Z`,
    vendedorId: 'vend-1',
    vendedorNombre: 'Vendedor 1',
    montoEfectivo: totalVendido,
    montoTransferencia: 0,
    totalVendido,
    salarioCalculado,
  };
}

describe('ReporteVentaDiaria', () => {
  it('muestra productos, totales y % de variación con datos del día', () => {
    mockState.user = { role: 'jefe', nombre: 'Jefe Principal' };
    // Hoy $20.000; hace una semana $10.000 (+100 %); hace un mes no hay datos (n/d).
    mockState.ventas = [venta(hoyStr, 20000, 1000), venta(semanaStr, 10000, 500)];
    // IPVE histórico: (10 + 5) − 3 = 12 unidades a $1.000 → importe $12.000.
    mockState.registros = [
      {
        id: 'r1',
        fecha: hoyStr,
        vendedorId: 'vend-1',
        vendedorNombre: 'Vendedor 1',
        productoId: 'p1',
        productoNombre: 'Producto A',
        inicio: 10,
        entrada: 5,
        final: 3,
        precioVenta: 1000,
        tipo: 'historico',
      },
    ];
    // PC = $600 → ganancia = 12 × (1000 − 600) = $4.800.
    mockState.productos = [
      { id: 'p1', nombre: 'Producto A', precioCompra: 600, precioVenta: 1000 },
    ];

    render(<ReporteVentaDiaria />);

    // El producto aparece en la tabla (escritorio) y en las tarjetas (móvil).
    expect(screen.getAllByText('Producto A').length).toBeGreaterThan(0);

    // Variaciones ±%: +100 % vs semana anterior; n/d vs mes anterior (base 0).
    expect(screen.getByText('+100 %')).toBeTruthy();
    expect(screen.getByText('n/d')).toBeTruthy();

    // Importe ($12.000) y ganancia ($4.800) por producto y en totales.
    expect(screen.getAllByText('$12.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$4.800').length).toBeGreaterThan(0);

    // Fila TOTAL y ganancia neta = 4.800 − 1.000 = 3.800.
    expect(screen.getByText('TOTAL')).toBeTruthy();
    expect(screen.getByText('$3.800')).toBeTruthy();
  });

  it('sin registros muestra el aviso de IPVE y no la tabla de productos', () => {
    mockState.user = { role: 'jefe', nombre: 'Jefe Principal' };
    mockState.ventas = [];
    mockState.registros = [];
    mockState.productos = [];

    render(<ReporteVentaDiaria />);

    expect(screen.getByText(/Registra el IPVE del día para ver el detalle por producto/)).toBeTruthy();
    expect(screen.getByText(/No hay ventas registradas para este día/)).toBeTruthy();
    expect(screen.queryByText('TOTAL')).toBeNull();
  });

  it('con rol vendedor muestra la tarjeta de no autorizado', () => {
    mockState.user = { role: 'vendedor', nombre: 'Vendedor' };
    mockState.ventas = [];
    mockState.registros = [];
    mockState.productos = [];

    render(<ReporteVentaDiaria />);

    expect(screen.getByText('No autorizado')).toBeTruthy();
    expect(screen.queryByText('Fecha del reporte')).toBeNull();
  });
});
