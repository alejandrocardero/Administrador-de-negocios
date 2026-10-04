-- ============================================
-- MULTI-TENANT SCHEMA PARA ADMINNEGOCIO PRO
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLA PRINCIPAL: NEGOCIOS (TENANTS)
-- ============================================
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE, -- para subdominio futuro
    nit VARCHAR(50),
    direccion TEXT,
    telefono VARCHAR(50),
    email VARCHAR(200),
    regimen VARCHAR(20) DEFAULT 'simplificado' CHECK (regimen IN ('simplificado', 'comun')),
    tarifa_iva NUMERIC(5,2) DEFAULT 19.00,
    moneda VARCHAR(10) DEFAULT 'COP',
    owner_id UUID NOT NULL, -- auth.users.id del jefe creador
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por owner
CREATE INDEX idx_businesses_owner ON businesses(owner_id);

-- ============================================
-- MEMBRESÍAS: USUARIO ↔ NEGOCIO + ROL
-- ============================================
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL para roles virtuales
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('jefe', 'admin', 'comprador', 'vendedor')),
    nombre VARCHAR(100) NOT NULL, -- nombre visible en el negocio
    username VARCHAR(50) NOT NULL, -- username único POR NEGOCIO
    password_hash TEXT, -- solo para roles virtuales (no jefe)
    is_virtual BOOLEAN DEFAULT FALSE, -- TRUE = rol virtual (admin/comprador/vendedor)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, username), -- username único por negocio
    UNIQUE(user_id, business_id) -- un user_id real por negocio
);

CREATE INDEX idx_memberships_business ON memberships(business_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_virtual ON memberships(business_id, is_virtual) WHERE is_virtual = TRUE;

-- ============================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para businesses
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLAS DE DATOS CON business_id
-- ============================================

-- Productos
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('aseo', 'comida', 'bebidas', 'cerveza', 'otros')),
    precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
    porcentaje_ganancia NUMERIC(5,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 0,
    unidad VARCHAR(20) NOT NULL DEFAULT 'unidad',
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_productos_business ON productos(business_id);
CREATE INDEX idx_productos_codigo ON productos(business_id, codigo);
CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vendedores
CREATE TABLE vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vendedores_business ON vendedores(business_id);
CREATE TRIGGER update_vendedores_updated_at BEFORE UPDATE ON vendedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Compradores
CREATE TABLE compradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_compradores_business ON compradores(business_id);
CREATE TRIGGER update_compradores_updated_at BEFORE UPDATE ON compradores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ventas Diarias
CREATE TABLE ventas_diarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id),
    vendedor_nombre VARCHAR(100) NOT NULL,
    monto_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_vendido NUMERIC(12,2) GENERATED ALWAYS AS (monto_efectivo + monto_transferencia) STORED,
    salario_calculado NUMERIC(12,2) NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ventas_business_fecha ON ventas_diarias(business_id, fecha);
CREATE INDEX idx_ventas_vendedor ON ventas_diarias(vendedor_id);
CREATE TRIGGER update_ventas_diarias_updated_at BEFORE UPDATE ON ventas_diarias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Compras
CREATE TABLE compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    comprador_id UUID NOT NULL REFERENCES compradores(id),
    comprador_nombre VARCHAR(100) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'credito')),
    estado VARCHAR(20) NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'pendiente', 'cancelada')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_compras_business_fecha ON compras(business_id, fecha);
CREATE INDEX idx_compras_comprador ON compras(comprador_id);
CREATE TRIGGER update_compras_updated_at BEFORE UPDATE ON compras FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Detalles de Compra
CREATE TABLE detalles_compra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    producto_nombre VARCHAR(200) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);
CREATE INDEX idx_detalles_compra_compra ON detalles_compra(compra_id);

-- Gastos
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('servicios', 'nomina', 'arriendo', 'impuestos', 'mantenimiento', 'otros')),
    monto NUMERIC(12,2) NOT NULL DEFAULT 0,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gastos_business_fecha ON gastos(business_id, fecha);
CREATE TRIGGER update_gastos_updated_at BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Impuestos
CREATE TABLE impuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('iva', 'renta', 'ica', 'otro')),
    periodo VARCHAR(20) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    monto NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_impuestos_business ON impuestos(business_id);
CREATE TRIGGER update_impuestos_updated_at BEFORE UPDATE ON impuestos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Configuración del Negocio (1:1 con businesses)
CREATE TABLE configuracion_negocio (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    nit VARCHAR(50),
    direccion TEXT,
    telefono VARCHAR(50),
    email VARCHAR(200),
    regimen VARCHAR(20) DEFAULT 'simplificado' CHECK (regimen IN ('simplificado', 'comun')),
    tarifa_iva NUMERIC(5,2) DEFAULT 19.00,
    moneda VARCHAR(10) DEFAULT 'COP',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER update_configuracion_negocio_updated_at BEFORE UPDATE ON configuracion_negocio FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Movimientos de Caja
CREATE TABLE movimientos_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    concepto VARCHAR(200) NOT NULL,
    monto NUMERIC(12,2) NOT NULL DEFAULT 0,
    categoria VARCHAR(50) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_movimientos_caja_business_fecha ON movimientos_caja(business_id, fecha);

-- Registros IPVE
CREATE TABLE registros_ipve (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id),
    vendedor_nombre VARCHAR(100) NOT NULL,
    producto_id UUID NOT NULL REFERENCES productos(id),
    producto_nombre VARCHAR(200) NOT NULL,
    inicio INTEGER NOT NULL DEFAULT 0,
    entrada INTEGER NOT NULL DEFAULT 0,
    final INTEGER NOT NULL DEFAULT 0,
    precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('diario', 'historico')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_registros_ipve_business_fecha ON registros_ipve(business_id, fecha, tipo);
CREATE TRIGGER update_registros_ipve_updated_at BEFORE UPDATE ON registros_ipve FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Pedidos
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vendedor_id UUID NOT NULL REFERENCES vendedores(id),
    vendedor_nombre VARCHAR(100) NOT NULL,
    producto_id UUID NOT NULL REFERENCES productos(id),
    producto_nombre VARCHAR(200) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    cantidad_entregada INTEGER DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'entregado', 'cancelado')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pedidos_business ON pedidos(business_id);
CREATE INDEX idx_pedidos_vendedor ON pedidos(vendedor_id);
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Solicitudes de Productos Nuevos
CREATE TABLE solicitudes_producto_nuevo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    comprador_id UUID NOT NULL REFERENCES compradores(id),
    comprador_nombre VARCHAR(100) NOT NULL,
    nombre_producto VARCHAR(200) NOT NULL,
    precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
    cantidad INTEGER NOT NULL DEFAULT 1,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    notas TEXT,
    precio_venta NUMERIC(12,2),
    stock_minimo INTEGER,
    producto_id UUID REFERENCES productos(id),
    comentario_admin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_solicitudes_business ON solicitudes_producto_nuevo(business_id);
CREATE TRIGGER update_solicitudes_updated_at BEFORE UPDATE ON solicitudes_producto_nuevo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Salarios Fijos (por rol en el negocio)
CREATE TABLE salarios_fijos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('jefe', 'admin', 'comprador', 'vendedor')),
    nombre VARCHAR(100) NOT NULL,
    monto_semanal NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, rol)
);
CREATE TRIGGER update_salarios_fijos_updated_at BEFORE UPDATE ON salarios_fijos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fiados (Ventas a crédito)
CREATE TABLE fiados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    cliente_nombre VARCHAR(100) NOT NULL,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id),
    vendedor_nombre VARCHAR(100) NOT NULL,
    monto NUMERIC(12,2) NOT NULL DEFAULT 0,
    descripcion TEXT,
    notas TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrado')),
    fecha_cobro DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fiados_business ON fiados(business_id);
CREATE INDEX idx_fiados_vendedor ON fiados(vendedor_id);
CREATE INDEX idx_fiados_estado ON fiados(business_id, estado);
CREATE TRIGGER update_fiados_updated_at BEFORE UPDATE ON fiados FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE impuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ipve ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_producto_nuevo ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarios_fijos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiados ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS USANDO current_setting('app.current_business_id')
-- ============================================

-- Función helper para obtener business_id actual
CREATE OR REPLACE FUNCTION current_business_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_business_id', true), '')::UUID;
$$;

-- Políticas para businesses: solo el owner ve su negocio
CREATE POLICY "business_owner_select" ON businesses
    FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "business_owner_insert" ON businesses
    FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "business_owner_update" ON businesses
    FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "business_owner_delete" ON businesses
    FOR DELETE USING (owner_id = auth.uid());

-- Políticas para memberships: usuarios ven sus memberships
CREATE POLICY "membership_user_select" ON memberships
    FOR SELECT USING (user_id = auth.uid() OR business_id = current_business_id());
CREATE POLICY "membership_business_insert" ON memberships
    FOR INSERT WITH CHECK (business_id = current_business_id());
CREATE POLICY "membership_business_update" ON memberships
    FOR UPDATE USING (business_id = current_business_id());
CREATE POLICY "membership_business_delete" ON memberships
    FOR DELETE USING (business_id = current_business_id());

-- Políticas genéricas para TODAS las tablas de datos: aislamiento por business_id
-- Usamos una función para generar políticas dinámicamente

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'productos', 'vendedores', 'compradores', 'ventas_diarias', 'compras',
        'gastos', 'impuestos', 'configuracion_negocio',
        'movimientos_caja', 'registros_ipve', 'pedidos', 'solicitudes_producto_nuevo',
        'salarios_fijos', 'fiados'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            CREATE POLICY "%s_business_isolation" ON %s
                FOR ALL USING (business_id = current_business_id());
        ', tbl, tbl);
    END LOOP;
END $$;

-- detalles_compra NO tiene columna business_id: se aísla a través de su compra padre
CREATE POLICY "detalles_compra_business_isolation" ON detalles_compra
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM compras c
            WHERE c.id = detalles_compra.compra_id
              AND c.business_id = current_business_id()
        )
    );

-- ============================================
-- FUNCIÓN PARA ONBOARDING ATÓMICO
-- ============================================
CREATE OR REPLACE FUNCTION onboard_business(
    p_nombre TEXT,
    p_slug TEXT,
    p_nit TEXT,
    p_direccion TEXT,
    p_telefono TEXT,
    p_email TEXT,
    p_regimen TEXT,
    p_tarifa_iva NUMERIC,
    p_moneda TEXT,
    p_jefe_nombre TEXT,
    p_jefe_email TEXT,
    p_jefe_password TEXT,
    p_roles_json JSONB -- {admin: {username, password, nombre}, comprador: {...}, vendedor: {...}}
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_business_id UUID;
    v_owner_id UUID;
    v_role TEXT;
    v_role_data JSONB;
    v_membership_id UUID;
BEGIN
    -- 1. Crear usuario real en auth.users (JEFE)
    INSERT INTO auth.users (instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        p_jefe_email,
        crypt(p_jefe_password, gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', p_jefe_nombre),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_owner_id;

    -- 2. Crear negocio
    INSERT INTO businesses (nombre, slug, nit, direccion, telefono, email, regimen, tarifa_iva, moneda, owner_id)
    VALUES (p_nombre, p_slug, p_nit, p_direccion, p_telefono, p_email, p_regimen, p_tarifa_iva, p_moneda, v_owner_id)
    RETURNING id INTO v_business_id;

    -- 3. Configuración del negocio
    INSERT INTO configuracion_negocio (business_id, nombre, nit, direccion, telefono, email, regimen, tarifa_iva, moneda)
    VALUES (v_business_id, p_nombre, p_nit, p_direccion, p_telefono, p_email, p_regimen, p_tarifa_iva, p_moneda);

    -- 4. Membresía del JEFE (usuario real)
    INSERT INTO memberships (user_id, business_id, role, nombre, username, is_virtual)
    VALUES (v_owner_id, v_business_id, 'jefe', p_jefe_nombre, 'jefe', FALSE);

    -- 5. Salarios fijos por defecto (0)
    INSERT INTO salarios_fijos (business_id, rol, nombre, monto_semanal)
    VALUES 
        (v_business_id, 'jefe', 'Jefe Principal', 0),
        (v_business_id, 'admin', 'Administrador', 0),
        (v_business_id, 'comprador', 'Comprador', 0),
        (v_business_id, 'vendedor', 'Vendedor', 0);

    -- 6. Crear roles virtuales (admin, comprador, vendedor)
    FOR v_role IN SELECT jsonb_object_keys(p_roles_json) LOOP
        v_role_data := p_roles_json->v_role;
        INSERT INTO memberships (user_id, business_id, role, nombre, username, password_hash, is_virtual)
        VALUES (
            NULL, -- NULL para usuarios virtuales
            v_business_id,
            v_role,
            v_role_data->>'nombre',
            v_role_data->>'username',
            crypt(v_role_data->>'password', gen_salt('bf')),
            TRUE
        );
    END LOOP;

    -- 7. Retornar credenciales
    RETURN jsonb_build_object(
        'business_id', v_business_id,
        'business_nombre', p_nombre,
        'owner_id', v_owner_id,
        'credentials', jsonb_build_object(
            'jefe', jsonb_build_object('email', p_jefe_email, 'password', p_jefe_password, 'nombre', p_jefe_nombre),
            'admin', jsonb_build_object('username', p_roles_json->'admin'->>'username', 'password', p_roles_json->'admin'->>'password', 'nombre', p_roles_json->'admin'->>'nombre'),
            'comprador', jsonb_build_object('username', p_roles_json->'comprador'->>'username', 'password', p_roles_json->'comprador'->>'password', 'nombre', p_roles_json->'comprador'->>'nombre'),
            'vendedor', jsonb_build_object('username', p_roles_json->'vendedor'->>'username', 'password', p_roles_json->'vendedor'->>'password', 'nombre', p_roles_json->'vendedor'->>'nombre')
        )
    );
EXCEPTION
    WHEN unique_violation THEN
        -- Limpiar usuario auth si falla
        IF v_owner_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = v_owner_id;
        END IF;
        RAISE EXCEPTION 'Error: El slug del negocio o email ya existe';
    WHEN OTHERS THEN
        IF v_owner_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = v_owner_id;
        END IF;
        RAISE;
END;
$$;

-- ============================================
-- FUNCIÓN LOGIN PARA ROLES VIRTUALES
-- ============================================
CREATE OR REPLACE FUNCTION login_virtual_role(
    p_business_id UUID,
    p_username TEXT,
    p_password TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_membership memberships%ROWTYPE;
BEGIN
    SELECT * INTO v_membership
    FROM memberships
    WHERE business_id = p_business_id
      AND username = p_username
      AND is_virtual = TRUE
      AND role IN ('admin', 'comprador', 'vendedor')
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Usuario o contraseña incorrectos');
    END IF;

    IF v_membership.password_hash IS NULL OR v_membership.password_hash != crypt(p_password, v_membership.password_hash) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Usuario o contraseña incorrectos');
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'membership', jsonb_build_object(
            'id', v_membership.id,
            'business_id', v_membership.business_id,
            'role', v_membership.role,
            'nombre', v_membership.nombre,
            'username', v_membership.username,
            'is_virtual', TRUE
        )
    );
END;
$$;

-- ============================================
-- FUNCIÓN PARA OBTENER MEMBERSHIPS DEL USUARIO ACTUAL
-- ============================================
CREATE OR REPLACE FUNCTION get_user_memberships()
RETURNS TABLE (
    id UUID,
    business_id UUID,
    business_nombre TEXT,
    business_slug TEXT,
    role TEXT,
    nombre TEXT,
    username TEXT,
    is_virtual BOOLEAN,
    is_owner BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.business_id,
        b.nombre as business_nombre,
        b.slug as business_slug,
        m.role,
        m.nombre,
        m.username,
        m.is_virtual,
        (b.owner_id = auth.uid()) as is_owner
    FROM memberships m
    JOIN businesses b ON b.id = m.business_id
    WHERE m.user_id = auth.uid()
       OR (m.is_virtual = FALSE AND b.owner_id = auth.uid());
END;
$$;