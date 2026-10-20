-- ============================================
-- 005: CIERRE DE CAJA — sobrante/faltante
-- (PLAN-CIERRE-CAJA-5-BUGS.md, Bugs 2 y 4)
-- diferencia_caja = (efectivo + transferencia) − importe IPVE del vendedor ese día
-- positivo = sobrante, negativo = faltante, NULL = sin IPVE para comparar
-- ============================================

ALTER TABLE ventas_diarias
    ADD COLUMN IF NOT EXISTS diferencia_caja NUMERIC(12,2);

COMMENT ON COLUMN ventas_diarias.diferencia_caja IS
    'Sobrante (+) o faltante (−) del cierre de caja vs el importe IPVE del vendedor ese día. NULL = sin IPVE para comparar.';
