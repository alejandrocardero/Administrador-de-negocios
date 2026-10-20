import { describe, it, expect } from 'vitest';
import {
  MARGEN_MIN,
  MARGEN_MAX,
  round2,
  clampMargen,
  margen,
  precioDesdeMargen,
  margenDesdePrecio,
  gananciaProducto,
  formatMargen,
} from '../ganancia';

describe('precioDesdeMargen (PV = PC / (1 − %/100))', () => {
  it('calcula el precio de venta con el ejemplo del usuario: PC=800, 25 % → 1066.67', () => {
    expect(precioDesdeMargen(800, 25)).toBe(1066.67);
  });

  it('calcula PC=1.000, 40 % → 1.666,67', () => {
    expect(precioDesdeMargen(1000, 40)).toBe(1666.67);
  });

  it('con 0 % el precio de venta es igual al precio de compra', () => {
    expect(precioDesdeMargen(800, 0)).toBe(800);
  });

  it('bloquea el 100 % (tope 99 %): PC=800 → 80.000', () => {
    expect(precioDesdeMargen(800, 100)).toBe(80000);
    expect(precioDesdeMargen(800, 150)).toBe(80000);
  });

  it('con PC=0 el precio de venta es 0', () => {
    expect(precioDesdeMargen(0, 25)).toBe(0);
  });

  it('con % negativo se limita a 0 y PV = PC', () => {
    expect(precioDesdeMargen(800, -10)).toBe(800);
  });
});

describe('margen / margenDesdePrecio (ida y vuelta)', () => {
  it('margen(1066.67, 800) = 25 %', () => {
    expect(margen(1066.67, 800)).toBe(25);
  });

  it('ida y vuelta: de PC=800 y 25 % se recupera el 25 %', () => {
    const pv = precioDesdeMargen(800, 25);
    expect(margenDesdePrecio(800, pv)).toBe(25);
  });

  it('PV=0 → margen no calculable (null)', () => {
    expect(margen(0, 800)).toBeNull();
    expect(margenDesdePrecio(0, 0)).toBeNull();
  });

  it('PC=0 → margen del 100 %', () => {
    expect(margen(1000, 0)).toBe(100);
  });

  it('márgenes negativos (venta por debajo del costo)', () => {
    expect(margen(500, 800)).toBe(-60);
    expect(margenDesdePrecio(800, 500)).toBe(-60);
  });

  it('margen 100 % exacto (PV=PC)', () => {
    expect(margen(800, 800)).toBe(0);
  });
});

describe('clampMargen', () => {
  it('limita al rango [MARGEN_MIN, MARGEN_MAX]', () => {
    expect(MARGEN_MIN).toBe(0);
    expect(MARGEN_MAX).toBe(99);
    expect(clampMargen(-5)).toBe(0);
    expect(clampMargen(42)).toBe(42);
    expect(clampMargen(99)).toBe(99);
    expect(clampMargen(100)).toBe(99);
    expect(clampMargen(Number.NaN)).toBe(0);
  });
});

describe('gananciaProducto', () => {
  it('ganancia = vendido × (PV − PC)', () => {
    expect(gananciaProducto(12, 1000, 600)).toBe(4800);
  });

  it('redondea a 2 decimales', () => {
    expect(gananciaProducto(3, 10.333, 4.111)).toBe(18.67);
  });

  it('permite ganancia negativa', () => {
    expect(gananciaProducto(2, 500, 800)).toBe(-600);
  });
});

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(1066.666666)).toBe(1066.67);
  });
});

describe('formatMargen', () => {
  it('formatea en es-CO con coma decimal: 25,5 %', () => {
    expect(formatMargen(25.5)).toBe('25,5 %');
  });

  it('sin decimales innecesarios: 25 %', () => {
    expect(formatMargen(25)).toBe('25 %');
  });

  it('máximo un decimal', () => {
    expect(formatMargen(33.3333)).toBe('33,3 %');
  });

  it('negativos', () => {
    expect(formatMargen(-12.5)).toBe('-12,5 %');
  });

  it('null → em dash (no calculable)', () => {
    expect(formatMargen(null)).toBe('—');
  });
});
