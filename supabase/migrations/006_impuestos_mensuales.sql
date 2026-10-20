-- 006: Impuestos mensuales fijos (Pago ONAT y Depósito Bancario)
-- Amplía el catálogo de tipos de impuesto con 'onat' y 'deposito_bancario'.
-- Estos dos tipos se auto-generan el día 1 de cada mes como registros pendientes
-- (uno por negocio), y el usuario con rol 'jefe' recibe una alerta hasta pagarlos.

ALTER TABLE impuestos DROP CONSTRAINT impuestos_tipo_check;
ALTER TABLE impuestos ADD CONSTRAINT impuestos_tipo_check
    CHECK (tipo IN ('iva', 'renta', 'ica', 'otro', 'onat', 'deposito_bancario'));

COMMENT ON CONSTRAINT impuestos_tipo_check ON impuestos IS
    'onat y deposito_bancario son impuestos mensuales fijos: se auto-generan el dia 1 de cada mes como pendientes y se pagan introduciendo el monto pagado.';
