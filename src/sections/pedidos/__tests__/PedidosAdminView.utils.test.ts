import { describe, it, expect } from 'vitest';
import type { Pedido } from '@/types';

// Copied from PedidosAdminView.tsx for testing
const isPedidoReposicion = (pedido: Pedido): boolean => {
  return pedido.notas?.includes('[REPOSICION]') ?? false;
};

const getReposicionStockInfo = (notas?: string): { final: number; minimo: number } | null => {
  if (!notas) return null;
  const match = notas.match(/Stock final: (\d+) \(mín: (\d+)\)/);
  if (match) {
    return { final: parseInt(match[1]), minimo: parseInt(match[2]) };
  }
  return null;
};

describe('isPedidoReposicion', () => {
  const basePedido: Pedido = {
    id: '1',
    fecha: '2024-01-15',
    vendedorId: 'v1',
    vendedorNombre: 'Juan',
    productoId: 'p1',
    productoNombre: 'Producto Test',
    cantidad: 10,
    estado: 'pendiente',
  };

  it('returns true for pedido with [REPOSICION] in notas', () => {
    const pedido = { ...basePedido, notas: '[REPOSICION] Stock final: 0 (mín: 5) - Solicitud automática tras guardar día' };
    expect(isPedidoReposicion(pedido)).toBe(true);
  });

  it('returns false for pedido without [REPOSICION] in notas', () => {
    const pedido = { ...basePedido, notas: 'Pedido normal del vendedor' };
    expect(isPedidoReposicion(pedido)).toBe(false);
  });

  it('returns false for pedido with undefined notas', () => {
    const pedido = { ...basePedido, notas: undefined };
    expect(isPedidoReposicion(pedido)).toBe(false);
  });

  it('returns false for pedido with empty notas', () => {
    const pedido = { ...basePedido, notas: '' };
    expect(isPedidoReposicion(pedido)).toBe(false);
  });

  it('is case sensitive - lowercase [reposicion] returns false', () => {
    const pedido = { ...basePedido, notas: '[reposicion] Stock final: 0 (mín: 5)' };
    expect(isPedidoReposicion(pedido)).toBe(false);
  });
});

describe('getReposicionStockInfo', () => {
  it('parses stock final and minimo from valid reposicion notas', () => {
    const notas = '[REPOSICION] Stock final: 3 (mín: 10) - Solicitud automática tras guardar día';
    const result = getReposicionStockInfo(notas);
    expect(result).toEqual({ final: 3, minimo: 10 });
  });

  it('handles zero values', () => {
    const notas = '[REPOSICION] Stock final: 0 (mín: 5) - Solicitud automática tras guardar día';
    const result = getReposicionStockInfo(notas);
    expect(result).toEqual({ final: 0, minimo: 5 });
  });

  it('handles large numbers', () => {
    const notas = '[REPOSICION] Stock final: 999 (mín: 1000) - Solicitud automática tras guardar día';
    const result = getReposicionStockInfo(notas);
    expect(result).toEqual({ final: 999, minimo: 1000 });
  });

  it('returns null for undefined notas', () => {
    expect(getReposicionStockInfo(undefined)).toBeNull();
  });

  it('returns null for empty notas', () => {
    expect(getReposicionStockInfo('')).toBeNull();
  });

  it('returns null for notas without stock pattern', () => {
    const notas = 'Pedido normal sin info de stock';
    expect(getReposicionStockInfo(notas)).toBeNull();
  });

  it('returns null for notas with malformed stock pattern', () => {
    const notas = '[REPOSICION] Stock: 3 Min: 10';
    expect(getReposicionStockInfo(notas)).toBeNull();
  });

  it('returns null for notas with partial pattern', () => {
    const notas = '[REPOSICION] Stock final: 3';
    expect(getReposicionStockInfo(notas)).toBeNull();
  });
});