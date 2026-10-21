import { describe, it, expect } from 'vitest';
import type { Producto } from '@/types';

// Mock types for testing
interface ProductoIPVE extends Producto {
  inicio: number;
  entrada: number;
  final: number;
}

// Logic copied from IPVE.tsx for testing
const filterProductosParaReposicion = (
  productosIPVE: ProductoIPVE[],
  productos: Producto[]
): ProductoIPVE[] => {
  return productosIPVE.filter(p => {
    const producto = productos.find(prod => prod.id === p.id);
    if (!producto) return false;
    return p.final <= producto.stockMinimo && (p.inicio > 0 || p.entrada > 0);
  });
};

const calculateSugeridaCantidad = (producto: Producto, final: number): number => {
  return Math.max(0, producto.stockMinimo - final + 5);
};

describe('filterProductosParaReposicion', () => {
  const mockProductos: Producto[] = [
    {
      id: 'p1',
      codigo: 'COD001',
      nombre: 'Producto A',
      descripcion: '',
      categoria: 'comida',
      precioCompra: 100,
      precioVenta: 200,
      porcentajeGanancia: 100,
      stock: 50,
      stockMinimo: 10,
      unidad: 'unidad',
      fechaRegistro: '2024-01-01',
      activo: true,
      esNuevo: false,
    },
    {
      id: 'p2',
      codigo: 'COD002',
      nombre: 'Producto B',
      descripcion: '',
      categoria: 'bebidas',
      precioCompra: 150,
      precioVenta: 300,
      porcentajeGanancia: 100,
      stock: 20,
      stockMinimo: 5,
      unidad: 'unidad',
      fechaRegistro: '2024-01-01',
      activo: true,
      esNuevo: false,
    },
    {
      id: 'p3',
      codigo: 'COD003',
      nombre: 'Producto C',
      descripcion: '',
      categoria: 'aseo',
      precioCompra: 200,
      precioVenta: 400,
      porcentajeGanancia: 100,
      stock: 30,
      stockMinimo: 8,
      unidad: 'unidad',
      fechaRegistro: '2024-01-01',
      activo: true,
      esNuevo: false,
    },
  ];

  it('includes product when final <= stockMinimo and has inicio', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 10, entrada: 0, final: 5 }, // final=5 <= stockMinimo=10, inicio>0
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('includes product when final <= stockMinimo and has entrada', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 0, entrada: 10, final: 5 }, // final=5 <= stockMinimo=10, entrada>0
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('includes product when final equals stockMinimo', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 10, entrada: 0, final: 10 }, // final=10 <= stockMinimo=10
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(1);
  });

  it('includes product when final is 0', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 10, entrada: 0, final: 0 }, // final=0 <= stockMinimo=10
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(1);
  });

  it('excludes product when final > stockMinimo', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 10, entrada: 0, final: 15 }, // final=15 > stockMinimo=10
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(0);
  });

  it('excludes product when no inicio and no entrada (no activity)', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 0, entrada: 0, final: 0 }, // no activity
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(0);
  });

  it('excludes product not found in productos list', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], id: 'p99', inicio: 10, entrada: 0, final: 5 }, // p99 not in productos
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(0);
  });

  it('filters multiple products correctly', () => {
    const productosIPVE: ProductoIPVE[] = [
      { ...mockProductos[0], inicio: 10, entrada: 0, final: 5 },   // needs reposicion (5 <= 10)
      { ...mockProductos[1], inicio: 10, entrada: 0, final: 10 },  // no reposicion (10 > 5)
      { ...mockProductos[2], inicio: 0, entrada: 5, final: 3 },    // needs reposicion (3 <= 8)
      { ...mockProductos[2], id: 'p3', inicio: 0, entrada: 0, final: 8 }, // no activity (excluded)
    ];
    const result = filterProductosParaReposicion(productosIPVE, mockProductos);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id).sort()).toEqual(['p1', 'p3']);
  });
});

describe('calculateSugeridaCantidad', () => {
  const mockProducto: Producto = {
    id: 'p1',
    codigo: 'COD001',
    nombre: 'Producto A',
    descripcion: '',
    categoria: 'comida',
    precioCompra: 100,
    precioVenta: 200,
    porcentajeGanancia: 100,
    stock: 50,
    stockMinimo: 10,
    unidad: 'unidad',
    fechaRegistro: '2024-01-01',
    activo: true,
    esNuevo: false,
  };

  it('calculates stockMinimo - final + 5 when final < stockMinimo', () => {
    // stockMinimo=10, final=5 -> 10-5+5 = 10
    expect(calculateSugeridaCantidad(mockProducto, 5)).toBe(10);
  });

  it('calculates 5 when final equals stockMinimo', () => {
    // stockMinimo=10, final=10 -> 10-10+5 = 5
    expect(calculateSugeridaCantidad(mockProducto, 10)).toBe(5);
  });

  it('calculates 5 when final is 0', () => {
    // stockMinimo=10, final=0 -> 10-0+5 = 15
    expect(calculateSugeridaCantidad(mockProducto, 0)).toBe(15);
  });

  it('returns 0 when final > stockMinimo (never negative)', () => {
    // stockMinimo=10, final=15 -> 10-15+5 = 0 (max with 0)
    expect(calculateSugeridaCantidad(mockProducto, 15)).toBe(0);
  });

  it('returns 0 when final exceeds stockMinimo by more than 5', () => {
    // stockMinimo=10, final=20 -> 10-20+5 = -5 -> max(0, -5) = 0
    expect(calculateSugeridaCantidad(mockProducto, 20)).toBe(0);
  });
});