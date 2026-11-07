-- ============================================
-- 006: SALARY FORMULA CONFIGURATION
-- Agrega campos para configurar fórmula de cálculo de salarios
-- ============================================

-- Agregar columnas a configuracion_negocio
ALTER TABLE configuracion_negocio
ADD COLUMN IF NOT EXISTS salario_usar_formula boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS salario_formula text,
ADD COLUMN IF NOT EXISTS salario_base_fija numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS salario_comision_porcentaje numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS salario_meta_ventas numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS salario_bono_meta numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS salario_formula_descripcion text;

-- Comentarios para documentación
COMMENT ON COLUMN configuracion_negocio.salario_usar_formula IS 'Si true, usa fórmula para calcular salarios; si false, usa salarios fijos por rol';
COMMENT ON COLUMN configuracion_negocio.salario_formula IS 'Expresión matemática para calcular salario. Variables: {ventasVendedor}, {ventasTotal}, {comisionPorcentaje}, {baseFija}, {metaVentas}, {bonoMeta}';
COMMENT ON COLUMN configuracion_negocio.salario_base_fija IS 'Base fija semanal por vendedor (se suma a comisión)';
COMMENT ON COLUMN configuracion_negocio.salario_comision_porcentaje IS 'Porcentaje de comisión sobre ventas del vendedor (ej: 5 para 5%)';
COMMENT ON COLUMN configuracion_negocio.salario_meta_ventas IS 'Meta de ventas semanal para bono';
COMMENT ON COLUMN configuracion_negocio.salario_bono_meta IS 'Bono al alcanzar la meta';
COMMENT ON COLUMN configuracion_negocio.salario_formula_descripcion IS 'Descripción legible de la fórmula para el usuario';

-- Ejemplo de fórmula: {baseFija} + ({ventasVendedor} * {comisionPorcentaje} / 100) + CASE WHEN {ventasVendedor} >= {metaVentas} THEN {bonoMeta} ELSE 0 END