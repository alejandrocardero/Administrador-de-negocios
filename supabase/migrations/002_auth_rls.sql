-- ============================================
-- 002: CUENTAS REALES PARA LOS 4 ROLES
--      + RLS POR MEMBRESÍA (auth.uid())
--      + ONBOARDING V2 + SELECTOR DE LOGIN PÚBLICO
-- Reemplaza el diseño anterior basado en current_setting('app.current_business_id')
-- que NO podía funcionar entre peticiones de PostgREST.
-- ============================================

-- ============================================
-- 1. HELPERS (SECURITY DEFINER -> evita recursión en RLS)
-- ============================================
CREATE OR REPLACE FUNCTION current_user_business_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(m.business_id), ARRAY[]::uuid[])
    FROM memberships m
    WHERE m.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION current_user_business_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_business_ids() TO anon, authenticated;

CREATE OR REPLACE FUNCTION is_business_owner(p_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM businesses b
        WHERE b.id = p_business_id AND b.owner_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION is_business_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_business_owner(uuid) TO anon, authenticated;

-- ============================================
-- 2. POLÍTICAS RLS POR MEMBRESÍA
-- ============================================
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'productos', 'vendedores', 'compradores', 'ventas_diarias', 'compras',
        'gastos', 'impuestos', 'configuracion_negocio', 'movimientos_caja',
        'registros_ipve', 'pedidos', 'solicitudes_producto_nuevo',
        'salarios_fijos', 'fiados'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_business_isolation" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_business_isolation" ON %I
            FOR ALL
            USING (business_id = ANY(current_user_business_ids()))
            WITH CHECK (business_id = ANY(current_user_business_ids()))', tbl, tbl);
    END LOOP;
END $$;

-- detalles_compra no tiene business_id: se aísla a través de su compra padre
DROP POLICY IF EXISTS "detalles_compra_business_isolation" ON detalles_compra;
CREATE POLICY "detalles_compra_business_isolation" ON detalles_compra
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM compras c
            WHERE c.id = detalles_compra.compra_id
              AND c.business_id = ANY(current_user_business_ids())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM compras c
            WHERE c.id = detalles_compra.compra_id
              AND c.business_id = ANY(current_user_business_ids())
        )
    );

-- businesses: visible para el owner y para cualquier miembro del negocio
DROP POLICY IF EXISTS "business_owner_select" ON businesses;
CREATE POLICY "business_member_select" ON businesses
    FOR SELECT USING (
        owner_id = auth.uid()
        OR id = ANY(current_user_business_ids())
    );
-- Se conservan: business_owner_insert / business_owner_update / business_owner_delete

-- memberships: cada quien ve lo suyo; solo el owner gestiona membresías
DROP POLICY IF EXISTS "membership_user_select" ON memberships;
DROP POLICY IF EXISTS "membership_business_insert" ON memberships;
DROP POLICY IF EXISTS "membership_business_update" ON memberships;
DROP POLICY IF EXISTS "membership_business_delete" ON memberships;

CREATE POLICY "membership_select" ON memberships
    FOR SELECT USING (
        user_id = auth.uid()
        OR business_id = ANY(current_user_business_ids())
    );
CREATE POLICY "membership_insert" ON memberships
    FOR INSERT WITH CHECK (
        business_id = ANY(current_user_business_ids())
        AND is_business_owner(business_id)
    );
CREATE POLICY "membership_update" ON memberships
    FOR UPDATE USING (
        business_id = ANY(current_user_business_ids())
        AND is_business_owner(business_id)
    )
    WITH CHECK (business_id = ANY(current_user_business_ids()));
CREATE POLICY "membership_delete" ON memberships
    FOR DELETE USING (
        business_id = ANY(current_user_business_ids())
        AND is_business_owner(business_id)
    );

-- ============================================
-- 3. ELIMINAR EL DISEÑO ANTERIOR
-- ============================================
DROP FUNCTION IF EXISTS login_virtual_role(uuid, text, text);
DROP FUNCTION IF EXISTS current_business_id();
DROP FUNCTION IF EXISTS onboard_business(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_user_memberships();
ALTER TABLE memberships DROP COLUMN IF EXISTS password_hash;

-- ============================================
-- 4. SELECTOR DE LOGIN (pantalla anónima)
--    Expone únicamente id/nombre/slug para poder
--    construir el email del rol: {usuario}@{slug}.app
-- ============================================
CREATE OR REPLACE FUNCTION list_businesses_for_login()
RETURNS TABLE (id uuid, nombre text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT b.id, b.nombre, b.slug
    FROM businesses b
    ORDER BY b.nombre;
$$;
REVOKE ALL ON FUNCTION list_businesses_for_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_businesses_for_login() TO anon, authenticated;

-- ============================================
-- 5. MEMBRESÍAS DEL USUARIO (post-login)
-- ============================================
CREATE OR REPLACE FUNCTION get_user_memberships()
RETURNS TABLE (
    id uuid,
    business_id uuid,
    business_nombre text,
    business_slug text,
    role text,
    nombre text,
    username text,
    is_virtual boolean,
    is_owner boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        m.id,
        m.business_id,
        b.nombre AS business_nombre,
        b.slug AS business_slug,
        m.role,
        m.nombre,
        m.username,
        m.is_virtual,
        (b.owner_id = auth.uid()) AS is_owner
    FROM memberships m
    JOIN businesses b ON b.id = m.business_id
    WHERE m.user_id = auth.uid()
    ORDER BY b.nombre;
$$;
REVOKE ALL ON FUNCTION get_user_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_memberships() TO authenticated;

-- ============================================
-- 6. UTILIDADES DE USUARIOS DE AUTH
-- ============================================
CREATE OR REPLACE FUNCTION create_auth_user(p_email text, p_password text, p_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        lower(p_email),
        crypt(p_password, gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', p_name),
        now(),
        now()
    )
    RETURNING id INTO v_id;

    INSERT INTO auth.identities (
        user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        v_id,
        v_id::text,
        'email',
        jsonb_build_object(
            'sub', v_id::text,
            'email', lower(p_email),
            'email_verified', true,
            'phone_verified', false
        ),
        now(), now(), now()
    );

    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION create_auth_user(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_auth_user(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION drop_auth_users(p_ids uuid[])
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = auth, public
AS $$
    DELETE FROM auth.identities WHERE user_id = ANY(p_ids);
    DELETE FROM auth.users WHERE id = ANY(p_ids);
$$;
REVOKE ALL ON FUNCTION drop_auth_users(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION drop_auth_users(uuid[]) TO service_role;

-- ============================================
-- 7. ONBOARDING V2: 4 cuentas reales (jefe + 3 roles)
--    Email del rol: {username}@{slug}.app
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
    p_roles_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_business_id uuid;
    v_owner_id uuid;
    v_uid uuid;
    v_role text;
    v_role_data jsonb;
    v_username text;
    v_email text;
    v_created uuid[] := ARRAY[]::uuid[];
    v_credentials jsonb := '{}'::jsonb;
BEGIN
    -- ---- validaciones ----
    IF p_nombre IS NULL OR length(trim(p_nombre)) < 2 THEN
        RAISE EXCEPTION 'El nombre del negocio es obligatorio';
    END IF;
    IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{3,50}$' THEN
        RAISE EXCEPTION 'El identificador (slug) debe tener 3-50 caracteres: minúsculas, números y guiones';
    END IF;
    IF p_jefe_email IS NULL OR p_jefe_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'El email del jefe no es válido';
    END IF;
    IF p_jefe_password IS NULL OR length(p_jefe_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
    END IF;
    IF p_jefe_nombre IS NULL OR length(trim(p_jefe_nombre)) < 2 THEN
        RAISE EXCEPTION 'El nombre del jefe es obligatorio';
    END IF;

    -- ---- 1. usuario real: JEFE ----
    v_uid := create_auth_user(p_jefe_email, p_jefe_password, p_jefe_nombre);
    v_created := v_created || v_uid;
    v_owner_id := v_uid;

    -- ---- 2. negocio ----
    INSERT INTO businesses (nombre, slug, nit, direccion, telefono, email, regimen, tarifa_iva, moneda, owner_id)
    VALUES (p_nombre, p_slug, p_nit, p_direccion, p_telefono, p_email, p_regimen, p_tarifa_iva, p_moneda, v_owner_id)
    RETURNING id INTO v_business_id;

    -- ---- 3. configuración del negocio ----
    INSERT INTO configuracion_negocio (business_id, nombre, nit, direccion, telefono, email, regimen, tarifa_iva, moneda)
    VALUES (v_business_id, p_nombre, p_nit, p_direccion, p_telefono, p_email, p_regimen, p_tarifa_iva, p_moneda);

    -- ---- 4. membresía del JEFE ----
    INSERT INTO memberships (user_id, business_id, role, nombre, username, is_virtual)
    VALUES (v_owner_id, v_business_id, 'jefe', p_jefe_nombre, 'jefe', FALSE);

    -- ---- 5. salarios fijos por defecto ----
    INSERT INTO salarios_fijos (business_id, rol, nombre, monto_semanal)
    VALUES
        (v_business_id, 'jefe', 'Jefe Principal', 0),
        (v_business_id, 'admin', 'Administrador', 0),
        (v_business_id, 'comprador', 'Comprador', 0),
        (v_business_id, 'vendedor', 'Vendedor', 0);

    -- ---- 6. roles: ADMIN, COMPRADOR, VENDEDOR con cuenta real ----
    FOREACH v_role IN ARRAY ARRAY['admin', 'comprador', 'vendedor'] LOOP
        v_role_data := p_roles_json -> v_role;

        IF v_role_data IS NULL
           OR v_role_data ->> 'username' IS NULL
           OR v_role_data ->> 'password' IS NULL
           OR v_role_data ->> 'nombre' IS NULL THEN
            RAISE EXCEPTION 'Faltan credenciales para el rol %', v_role;
        END IF;

        v_username := lower(trim(v_role_data ->> 'username'));
        IF v_username !~ '^[a-z0-9_.-]{3,30}$' THEN
            RAISE EXCEPTION 'Usuario "%" inválido del rol %: usa de 3 a 30 caracteres (letras, números, punto, guion o guion bajo)', v_username, v_role;
        END IF;
        IF length(v_role_data ->> 'password') < 6 THEN
            RAISE EXCEPTION 'La contraseña del rol % debe tener al menos 6 caracteres', v_role;
        END IF;

        v_email := v_username || '@' || p_slug || '.app';
        v_uid := create_auth_user(v_email, v_role_data ->> 'password', v_role_data ->> 'nombre');
        v_created := v_created || v_uid;

        INSERT INTO memberships (user_id, business_id, role, nombre, username, is_virtual)
        VALUES (v_uid, v_business_id, v_role, v_role_data ->> 'nombre', v_username, TRUE);

        v_credentials := v_credentials || jsonb_build_object(v_role, jsonb_build_object(
            'username', v_username,
            'password', v_role_data ->> 'password',
            'nombre', v_role_data ->> 'nombre',
            'email', v_email
        ));
    END LOOP;

    -- ---- 7. respuesta ----
    RETURN jsonb_build_object(
        'business_id', v_business_id,
        'business_nombre', p_nombre,
        'owner_id', v_owner_id,
        'credentials', v_credentials || jsonb_build_object('jefe', jsonb_build_object(
            'email', p_jefe_email,
            'password', p_jefe_password,
            'nombre', p_jefe_nombre
        ))
    );
EXCEPTION
    WHEN unique_violation THEN
        PERFORM drop_auth_users(v_created);
        RAISE EXCEPTION 'El identificador (slug) del negocio o el email de un rol ya existe';
    WHEN OTHERS THEN
        PERFORM drop_auth_users(v_created);
        RAISE;
END;
$$;
REVOKE ALL ON FUNCTION onboard_business(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION onboard_business(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
