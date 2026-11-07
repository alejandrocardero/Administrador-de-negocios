-- ============================================
-- 005: PRODUCT APPROVAL FLOW + TAGS
-- Implementa flujo de aprobación de productos nuevos y cambios de precio
-- con sistema de etiquetas temporales en inventario
-- ============================================

-- ============================================
-- 1. Tabla de productos pendientes de aprobación
-- ============================================
CREATE TABLE IF NOT EXISTS productos_pendientes_aprobacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    comprador_id uuid NOT NULL REFERENCES compradores(id) ON DELETE CASCADE,
    comprador_nombre text NOT NULL,
    
    -- Datos del producto desde el comprador
    nombre text NOT NULL,
    categoria categoria_producto NOT NULL,
    precio_compra numeric(12,2) NOT NULL,
    cantidad_inicial integer NOT NULL DEFAULT 0,
    unidad text NOT NULL DEFAULT 'unidad',
    notas text,
    
    -- Tipo de solicitud
    tipo text NOT NULL CHECK (tipo IN ('nuevo', 'cambio_precio')),
    
    -- Para cambios de precio: referencia al producto existente
    producto_existente_id uuid REFERENCES productos(id) ON DELETE SET NULL,
    precio_compra_anterior numeric(12,2),
    
    -- Decisión del admin (se llena al aprobar)
    precio_venta numeric(12,2),
    stock_minimo integer,
    porcentaje_ganancia integer,
    comentario_admin text,
    
    estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    fecha_creacion timestamptz NOT NULL DEFAULT now(),
    fecha_resolucion timestamptz,
    resuelto_por uuid REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_productos_pendientes_business 
    ON productos_pendientes_aprobacion(business_id, estado, fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_productos_pendientes_comprador 
    ON productos_pendientes_aprobacion(comprador_id, estado);

-- RLS
ALTER TABLE productos_pendientes_aprobacion ENABLE ROW LEVEL SECURITY;

-- Comprador ve solo sus solicitudes
DROP POLICY IF EXISTS "productos_pendientes_comprador_select" ON productos_pendientes_aprobacion;
CREATE POLICY "productos_pendientes_comprador_select" ON productos_pendientes_aprobacion
    FOR SELECT USING (
        comprador_id = ANY(current_user_comprador_ids())
    );

-- Admin/jefe ve todas del negocio
DROP POLICY IF EXISTS "productos_pendientes_admin_all" ON productos_pendientes_aprobacion;
CREATE POLICY "productos_pendientes_admin_all" ON productos_pendientes_aprobacion
    FOR ALL USING (
        business_id = ANY(current_user_business_ids()) 
        AND current_user_role() IN ('admin', 'jefe')
    )
    WITH CHECK (
        business_id = ANY(current_user_business_ids()) 
        AND current_user_role() IN ('admin', 'jefe')
    );

-- Comprador puede insertar sus solicitudes
DROP POLICY IF EXISTS "productos_pendientes_comprador_insert" ON productos_pendientes_aprobacion;
CREATE POLICY "productos_pendientes_comprador_insert" ON productos_pendientes_aprobacion
    FOR INSERT WITH CHECK (
        comprador_id = ANY(current_user_comprador_ids())
        AND business_id = ANY(current_user_business_ids())
    );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS sync_touch_productos_pendientes ON productos_pendientes_aprobacion;
CREATE TRIGGER sync_touch_productos_pendientes
    BEFORE UPDATE ON productos_pendientes_aprobacion
    FOR EACH ROW EXECUTE FUNCTION sync_touch();

-- ============================================
-- 2. Extensiones a tabla productos (tags)
-- ============================================
DO $$
BEGIN
    -- Tipo de etiqueta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'productos' AND column_name = 'tag_tipo') THEN
        ALTER TABLE productos ADD COLUMN tag_tipo text 
            CHECK (tag_tipo IN ('nuevo', 'cambio_precio'));
    END IF;
    
    -- Expiración de la etiqueta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'productos' AND column_name = 'tag_expira_en') THEN
        ALTER TABLE productos ADD COLUMN tag_expira_en timestamptz;
    END IF;
    
    -- Compra que originó la etiqueta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'productos' AND column_name = 'tag_origen_compra_id') THEN
        ALTER TABLE productos ADD COLUMN tag_origen_compra_id uuid REFERENCES compras(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índice para productos con tag activo
CREATE INDEX IF NOT EXISTS idx_productos_tag_activo 
    ON productos(business_id, tag_tipo, tag_expira_en) 
    WHERE tag_tipo IS NOT NULL AND (tag_expira_en IS NULL OR tag_expira_en > now());

-- ============================================
-- 3. Función para limpiar tags expirados
-- ============================================
CREATE OR REPLACE FUNCTION limpiar_tags_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_count integer;
BEGIN
    -- Expirar tags por fecha
    UPDATE productos
       SET tag_tipo = NULL, tag_expira_en = NULL, tag_origen_compra_id = NULL
     WHERE business_id = ANY(current_user_business_ids())
       AND tag_tipo IS NOT NULL
       AND tag_expira_en IS NOT NULL
       AND tag_expira_en <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$fn$;
REVOKE ALL ON FUNCTION limpiar_tags_expirados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION limpiar_tags_expirados() TO authenticated, service_role;

-- ============================================
-- 4. Función para limpiar tags por entrada de stock o stock=0
-- ============================================
CREATE OR REPLACE FUNCTION limpiar_tag_si_corresponde(p_producto_id uuid, p_nueva_entrada integer DEFAULT 0, p_nuevo_stock integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_producto productos%ROWTYPE;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    IF NOT FOUND OR v_producto.tag_tipo IS NULL THEN
        RETURN;
    END IF;
    
    -- Limpiar si hay entrada nueva (re-stock)
    IF p_nueva_entrada > 0 THEN
        UPDATE productos
           SET tag_tipo = NULL, tag_expira_en = NULL, tag_origen_compra_id = NULL
         WHERE id = p_producto_id;
        RETURN;
    END IF;
    
    -- Limpiar si stock llegó a 0
    IF p_nuevo_stock IS NOT NULL AND p_nuevo_stock <= 0 THEN
        UPDATE productos
           SET tag_tipo = NULL, tag_expira_en = NULL, tag_origen_compra_id = NULL
         WHERE id = p_producto_id;
        RETURN;
    END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION limpiar_tag_si_corresponde(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION limpiar_tag_si_corresponde(uuid, integer, integer) TO authenticated, service_role;

-- ============================================
-- 5. RPC para crear solicitud de aprobación
-- ============================================
CREATE OR REPLACE FUNCTION crear_solicitud_producto(
    p_comprador_id uuid,
    p_nombre text,
    p_categoria categoria_producto,
    p_precio_compra numeric(12,2),
    p_cantidad_inicial integer,
    p_unidad text,
    p_tipo text, -- 'nuevo' | 'cambio_precio'
    p_producto_existente_id uuid DEFAULT NULL,
    p_precio_compra_anterior numeric(12,2) DEFAULT NULL,
    p_notas text DEFAULT NULL
)
RETURNS productos_pendientes_aprobacion
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_solicitud productos_pendientes_aprobacion;
    v_business_id uuid;
BEGIN
    -- Obtener business_id del comprador
    SELECT business_id INTO v_business_id
      FROM compradores
     WHERE id = p_comprador_id;
    
    IF v_business_id IS NULL THEN
        RAISE EXCEPTION 'Comprador no encontrado';
    END IF;
    
    -- Guard de tenant
    IF NOT (v_business_id = ANY(current_user_business_ids())) THEN
        RAISE EXCEPTION 'No autorizado para este negocio';
    END IF;
    
    -- Verificar que el comprador pertenece al usuario actual
    IF NOT (p_comprador_id = ANY(current_user_comprador_ids())) THEN
        RAISE EXCEPTION 'No autorizado para este comprador';
    END IF;
    
    INSERT INTO productos_pendientes_aprobacion (
        business_id, comprador_id, comprador_nombre,
        nombre, categoria, precio_compra, cantidad_inicial, unidad,
        tipo, producto_existente_id, precio_compra_anterior, notas
    )
    SELECT v_business_id, p_comprador_id, c.nombre,
           p_nombre, p_categoria, p_precio_compra, p_cantidad_inicial, p_unidad,
           p_tipo, p_producto_existente_id, p_precio_compra_anterior, p_notas
      FROM compradores c
     WHERE c.id = p_comprador_id
    RETURNING * INTO v_solicitud;
    
    RETURN v_solicitud;
END;
$fn$;
REVOKE ALL ON FUNCTION crear_solicitud_producto(uuid, text, categoria_producto, numeric, integer, text, text, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crear_solicitud_producto(uuid, text, categoria_producto, numeric, integer, text, text, uuid, numeric, text) TO authenticated, service_role;

-- ============================================
-- 6. RPC para aprobar solicitud (crea/actualiza producto + tag)
-- ============================================
CREATE OR REPLACE FUNCTION aprobar_solicitud_producto(
    p_solicitud_id uuid,
    p_precio_venta numeric(12,2),
    p_stock_minimo integer,
    p_porcentaje_ganancia integer,
    p_comentario_admin text DEFAULT NULL
)
RETURNS productos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_solicitud productos_pendientes_aprobacion%ROWTYPE;
    v_producto productos%ROWTYPE;
    v_tag_expira timestamptz;
    v_nuevo_producto boolean := false;
BEGIN
    -- Obtener solicitud con lock
    SELECT * INTO v_solicitud
      FROM productos_pendientes_aprobacion
     WHERE id = p_solicitud_id
       FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    
    -- Guard de tenant
    IF NOT (v_solicitud.business_id = ANY(current_user_business_ids())) THEN
        RAISE EXCEPTION 'No autorizado para este negocio';
    END IF;
    
    IF v_solicitud.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'Solicitud ya procesada';
    END IF;
    
    -- Calcular expiración del tag
    IF v_solicitud.tipo = 'cambio_precio' THEN
        v_tag_expira := now() + interval '7 days';
    ELSE
        v_tag_expira := NULL; -- "nuevo" expira por lógica de negocio (entrada o stock=0)
    END IF;
    
    IF v_solicitud.tipo = 'nuevo' THEN
        -- Crear producto nuevo
        v_nuevo_producto := true;
        INSERT INTO productos (
            business_id, codigo, nombre, descripcion, categoria,
            precio_compra, precio_venta, porcentaje_ganancia,
            stock, stock_minimo, unidad, fecha_registro, activo, es_nuevo,
            tag_tipo, tag_expira_en, tag_origen_compra_id
        ) VALUES (
            v_solicitud.business_id,
            'PRD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
            v_solicitud.nombre,
            '',
            v_solicitud.categoria,
            v_solicitud.precio_compra,
            p_precio_venta,
            p_porcentaje_ganancia,
            v_solicitud.cantidad_inicial,
            p_stock_minimo,
            v_solicitud.unidad,
            CURRENT_DATE,
            true,
            false, -- es_nuevo = false porque ya pasó por aprobación
            v_solicitud.tipo,
            v_tag_expira,
            NULL -- tag_origen_compra_id se llena cuando se haga la compra real
        ) RETURNING * INTO v_producto;
    ELSE
        -- Actualizar producto existente (cambio de precio)
        SELECT * INTO v_producto FROM productos WHERE id = v_solicitud.producto_existente_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto existente no encontrado';
        END IF;
        
        -- Si ya tenía tag "cambio_precio", se reemplaza (reinicia 7 días)
        UPDATE productos
           SET precio_compra = v_solicitud.precio_compra,
               precio_venta = p_precio_venta,
               porcentaje_ganancia = p_porcentaje_ganancia,
               stock_minimo = p_stock_minimo,
               tag_tipo = 'cambio_precio',
               tag_expira_en = v_tag_expira,
               updated_at = now()
         WHERE id = v_solicitud.producto_existente_id
        RETURNING * INTO v_producto;
    END IF;
    
    -- Marcar solicitud como aprobada
    UPDATE productos_pendientes_aprobacion
       SET estado = 'aprobado',
           precio_venta = p_precio_venta,
           stock_minimo = p_stock_minimo,
           porcentaje_ganancia = p_porcentaje_ganancia,
           comentario_admin = p_comentario_admin,
           fecha_resolucion = now(),
           resuelto_por = auth.uid()
     WHERE id = p_solicitud_id;
    
    RETURN v_producto;
END;
$fn$;
REVOKE ALL ON FUNCTION aprobar_solicitud_producto(uuid, numeric, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION aprobar_solicitud_producto(uuid, numeric, integer, integer, text) TO authenticated, service_role;

-- ============================================
-- 7. RPC para rechazar solicitud
-- ============================================
CREATE OR REPLACE FUNCTION rechazar_solicitud_producto(
    p_solicitud_id uuid,
    p_comentario_admin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    UPDATE productos_pendientes_aprobacion
       SET estado = 'rechazado',
           comentario_admin = p_comentario_admin,
           fecha_resolucion = now(),
           resuelto_por = auth.uid()
     WHERE id = p_solicitud_id
       AND business_id = ANY(current_user_business_ids())
       AND estado = 'pendiente';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada o no autorizado';
    END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION rechazar_solicitud_producto(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rechazar_solicitud_producto(uuid, text) TO authenticated, service_role;