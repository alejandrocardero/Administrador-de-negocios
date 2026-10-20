-- 007: Etiqueta de producto nuevo
-- Los productos creados desde "Hacer Compras" (que no existían en el inventario)
-- se marcan con es_nuevo = true para mostrar la etiqueta "Nuevo" en el inventario.

ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS es_nuevo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN productos.es_nuevo IS
    'true si el producto fue creado desde la pantalla de compras (no existia en el inventario). Muestra la etiqueta "Nuevo" en el inventario.';
