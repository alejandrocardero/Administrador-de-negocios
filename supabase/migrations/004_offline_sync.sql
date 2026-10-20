-- ============================================
-- 004: OFFLINE-FIRST SYNC (Fase 0)
-- Implementa la sección 4 y el apéndice del
-- PLAN-OFFLINE-RESPONSIVE.md (v3):
--   * token/cursor de concurrencia sync_rev (secuencia global)
--   * feed de tombstones (sync_deletions)
--   * idempotencia (applied_ops)
--   * conflictos con ambas versiones (sync_conflicts)
--   * dispositivos + poda segura (sync_devices / sync_meta)
--   * RPCs SECURITY DEFINER con guard de tenant:
--       apply_mutation / resolver_conflicto / ajustar_stock
--   * detalles_compra.business_id
-- Idempotente hasta donde es razonable.
-- ============================================

-- ============================================
-- 4.1 Token/cursor: sinc_rev bigint
-- ============================================

-- Secuencia global (token de concurrencia Y cursor de pull)
CREATE SEQUENCE IF NOT EXISTS app_sync_seq;

-- Tablas replicadas (14). configuracion_negocio tiene PK = business_id.
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'productos', 'vendedores', 'compradores', 'ventas_diarias', 'compras',
        'gastos', 'impuestos', 'configuracion_negocio', 'movimientos_caja',
        'registros_ipve', 'pedidos', 'solicitudes_producto_nuevo', 'salarios_fijos', 'fiados'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS sync_rev bigint NOT NULL DEFAULT nextval(''app_sync_seq'')', tbl);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (business_id, sync_rev)', 'idx_' || tbl || '_sync_rev', tbl);
    END LOOP;
END $$;

-- movimientos_caja no tenía updated_at: se le añade
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================
-- 4.1 Trigger sync_touch (sustituye update_updated_at_column)
-- ============================================
CREATE OR REPLACE FUNCTION sync_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
    NEW.updated_at = now();
    NEW.sync_rev   = nextval('app_sync_seq');
    RETURN NEW;
END;
$fn$;

DO $$
DECLARE
    tbl text;
    trg record;
    tables text[] := ARRAY[
        'productos', 'vendedores', 'compradores', 'ventas_diarias', 'compras',
        'gastos', 'impuestos', 'configuracion_negocio', 'movimientos_caja',
        'registros_ipve', 'pedidos', 'solicitudes_producto_nuevo', 'salarios_fijos', 'fiados'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- Eliminar cualquier trigger previo de updated_at (update_<tabla>_updated_at,
        -- update_solicitudes_updated_at, etc.) que use la función vieja.
        FOR trg IN
            SELECT t.tgname
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = tbl
              AND NOT t.tgisinternal
              AND pg_get_triggerdef(t.oid) ILIKE '%update_updated_at_column%'
        LOOP
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trg.tgname, tbl);
        END LOOP;

        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'sync_touch_' || tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sync_touch()',
            'sync_touch_' || tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================
-- 4.2 Feed de tombstones (borrado físico propagable)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_deletions (
    seq         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    table_name  text NOT NULL,
    row_id      uuid NOT NULL,
    deleted_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_deletions_business ON sync_deletions(business_id, seq);

-- Trigger AFTER DELETE, SECURITY DEFINER (salta RLS). Nunca se aplica a
-- detalles_compra (se propaga por cascade del padre => business_id nulo).
CREATE OR REPLACE FUNCTION log_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    -- configuracion_negocio no tiene columna id (PK = business_id, trampa 10, §7):
    -- usar el identificador correcto por tabla.
    IF TG_TABLE_NAME = 'configuracion_negocio' THEN
        INSERT INTO sync_deletions (business_id, table_name, row_id, deleted_at)
        VALUES (OLD.business_id, TG_TABLE_NAME, OLD.business_id, now());
    ELSE
        INSERT INTO sync_deletions (business_id, table_name, row_id, deleted_at)
        VALUES (OLD.business_id, TG_TABLE_NAME, OLD.id, now());
    END IF;
    RETURN OLD;
END;
$fn$;
REVOKE ALL ON FUNCTION log_deletion() FROM PUBLIC;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'productos', 'vendedores', 'compradores', 'ventas_diarias', 'compras',
        'gastos', 'impuestos', 'configuracion_negocio', 'movimientos_caja',
        'registros_ipve', 'pedidos', 'solicitudes_producto_nuevo', 'salarios_fijos', 'fiados'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'log_deletion_' || tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION log_deletion()',
            'log_deletion_' || tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================
-- 4.3 Idempotencia
-- ============================================
CREATE TABLE IF NOT EXISTS applied_ops (
    mutation_id uuid PRIMARY KEY,
    business_id uuid NOT NULL,
    user_id     uuid,
    entity      text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now(),
    response    jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_applied_ops_business ON applied_ops(business_id, applied_at);

-- ============================================
-- 4.4 Conflictos (ambas versiones + historial auditable)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      uuid NOT NULL,
    table_name       text NOT NULL,
    row_id           uuid NOT NULL,
    kind             text NOT NULL CHECK (kind IN ('update_update', 'insert_insert', 'delete_update', 'delete_delete')),
    mutation_id      uuid UNIQUE,
    base_rev         bigint,
    server_version   jsonb,   -- null si el servidor borró
    incoming_version jsonb,   -- null si el cliente borró
    detected_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at      timestamptz,
    resolution       text CHECK (resolution IN ('mine', 'server', 'both', 'merged')),
    resolved_by      uuid,
    resolved_payload jsonb
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_open ON sync_conflicts(business_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_row ON sync_conflicts(business_id, table_name, row_id);
-- Las filas NUNCA se borran => historial.

-- ============================================
-- 4.5 Dispositivos + poda segura de tombstones
-- ============================================
CREATE TABLE IF NOT EXISTS sync_devices (
    device_id    uuid NOT NULL,
    business_id  uuid NOT NULL,
    user_id      uuid,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    last_pull_at timestamptz,
    PRIMARY KEY (device_id, business_id)
);
CREATE INDEX IF NOT EXISTS idx_sync_devices_business ON sync_devices(business_id);

CREATE TABLE IF NOT EXISTS sync_meta (
    business_id               uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    tombstones_pruned_through bigint NOT NULL DEFAULT 0
);

-- ============================================
-- 4.7 detalles_compra.business_id (rellenado desde el padre)
-- ============================================
ALTER TABLE detalles_compra ADD COLUMN IF NOT EXISTS business_id uuid;

DO $$
BEGIN
    UPDATE detalles_compra d
       SET business_id = c.business_id
      FROM compras c
     WHERE c.id = d.compra_id
       AND d.business_id IS NULL;
END $$;

-- Detalles huérfanos: eliminarlos para que el SET NOT NULL no falle
DELETE FROM detalles_compra WHERE compra_id NOT IN (SELECT id FROM compras);

ALTER TABLE detalles_compra ALTER COLUMN business_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_detalles_compra_business ON detalles_compra(business_id);

CREATE OR REPLACE FUNCTION detalles_compra_set_business_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
    IF NEW.business_id IS NULL THEN
        SELECT c.business_id INTO NEW.business_id
          FROM compras c
         WHERE c.id = NEW.compra_id;
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS detalles_compra_set_business_id ON detalles_compra;
CREATE TRIGGER detalles_compra_set_business_id
    BEFORE INSERT ON detalles_compra
    FOR EACH ROW
    EXECUTE FUNCTION detalles_compra_set_business_id();

-- ============================================
-- 4.8 RLS de las tablas nuevas
-- ============================================
ALTER TABLE sync_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_ops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_devices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_meta      ENABLE ROW LEVEL SECURITY;

-- SELECT por business (solo lectura para clientes; evita forja de tombstones)
DROP POLICY IF EXISTS "sync_deletions_select" ON sync_deletions;
CREATE POLICY "sync_deletions_select" ON sync_deletions
    FOR SELECT USING (business_id = ANY(current_user_business_ids()));

DROP POLICY IF EXISTS "sync_conflicts_select" ON sync_conflicts;
CREATE POLICY "sync_conflicts_select" ON sync_conflicts
    FOR SELECT USING (business_id = ANY(current_user_business_ids()));

DROP POLICY IF EXISTS "sync_meta_select" ON sync_meta;
CREATE POLICY "sync_meta_select" ON sync_meta
    FOR SELECT USING (business_id = ANY(current_user_business_ids()));

-- ALL por business para los dispositivos del usuario
DROP POLICY IF EXISTS "sync_devices_all" ON sync_devices;
CREATE POLICY "sync_devices_all" ON sync_devices
    FOR ALL
    USING (business_id = ANY(current_user_business_ids()))
    WITH CHECK (business_id = ANY(current_user_business_ids()));

-- applied_ops: SIN policy de cliente (solo lo escribe el RPC SECURITY DEFINER).

-- ============================================
-- 4.6 RPC auxiliar: agregado compras + detalles_compra
-- (unidad transaccional: reemplaza los detalles en bloque)
-- ============================================
CREATE OR REPLACE FUNCTION sync_replace_compra_detalles(
    p_compra_id   uuid,
    p_business_id uuid,
    p_detalles    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    d      jsonb;
    rec    record;
    v_cols text[];
    v_vals text[];
BEGIN
    -- Guard de tenant: la compra debe existir y pertenecer al negocio
    IF NOT EXISTS (
        SELECT 1 FROM compras WHERE id = p_compra_id AND business_id = p_business_id
    ) THEN
        RAISE EXCEPTION 'Compra no encontrada o sin acceso: %', p_compra_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Reemplazo en bloque (misma transacción que la compra)
    DELETE FROM detalles_compra WHERE compra_id = p_compra_id;

    FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(p_detalles, '[]'::jsonb)) LOOP
        IF jsonb_typeof(d) <> 'object' THEN
            RAISE EXCEPTION 'Detalle inválido en compras' USING ERRCODE = '22023';
        END IF;

        v_cols := ARRAY['compra_id'];
        v_vals := ARRAY[format('%L::uuid', p_compra_id)];

        -- id explícito del cliente (idempotencia de detalles)
        IF d ? 'id' AND jsonb_typeof(d->'id') = 'string' THEN
            v_cols := v_cols || 'id';
            v_vals := v_vals || format('%L::uuid', d->>'id');
        END IF;

        -- Columnas reales presentes en el detalle (excluye generadas/protegidas;
        -- business_id lo rellena el trigger desde el padre)
        FOR rec IN
            SELECT a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ
              FROM pg_attribute a
              JOIN pg_class c ON c.oid = a.attrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'detalles_compra'
               AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
               AND d ? a.attname
               AND a.attname NOT IN ('id', 'compra_id', 'subtotal', 'business_id', 'detalles')
             ORDER BY a.attnum
        LOOP
            v_cols := v_cols || rec.col;
            v_vals := v_vals || format('($1::jsonb->>%L)::%s', rec.col, rec.typ);
        END LOOP;

        EXECUTE format(
            'INSERT INTO detalles_compra (%s) VALUES (%s)',
            (SELECT string_agg(quote_ident(x), ', ') FROM unnest(v_cols) AS x),
            array_to_string(v_vals, ', ')
        ) USING d;
    END LOOP;
END;
$fn$;
REVOKE ALL ON FUNCTION sync_replace_compra_detalles(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_replace_compra_detalles(uuid, uuid, jsonb) TO authenticated, service_role;

-- ============================================
-- 4.6 RPC: apply_mutation
-- ============================================
CREATE OR REPLACE FUNCTION apply_mutation(
    p_mutation_id uuid,
    p_business_id uuid,
    p_entity      text,
    p_op          text,
    p_id          uuid,
    p_payload     jsonb,
    p_base_rev    bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_prev        jsonb;
    v_payload     jsonb;
    v_pk          text;
    v_id          uuid;
    v_rev         bigint;
    v_rows        integer;
    v_server      jsonb;
    v_kind        text;
    v_conflict_id uuid;
    v_result      jsonb;
    v_cols        text[];
    v_vals        text[];
    v_set         text;
    v_sql         text;
    rec           record;
    v_detalles    jsonb;
    v_tables      text[] := ARRAY[
        'productos', 'vendedores', 'compradores', 'ventas_diarias', 'compras',
        'gastos', 'impuestos', 'configuracion_negocio', 'movimientos_caja',
        'registros_ipve', 'pedidos', 'solicitudes_producto_nuevo', 'salarios_fijos', 'fiados'
    ];
BEGIN
    -- 1) Guard de tenant (DEFINER salta RLS => el guard es la defensa)
    IF p_business_id IS NULL OR NOT (p_business_id = ANY(current_user_business_ids())) THEN
        RAISE EXCEPTION 'No autorizado para el negocio %', p_business_id USING ERRCODE = '42501';
    END IF;

    -- 2) Idempotencia: repetir la respuesta exacta en reintentos
    SELECT response INTO v_prev FROM applied_ops WHERE mutation_id = p_mutation_id;
    IF FOUND THEN
        RETURN v_prev;
    END IF;

    -- Validaciones
    IF p_op NOT IN ('insert', 'update', 'delete') THEN
        RAISE EXCEPTION 'Operación no soportada: %', p_op USING ERRCODE = '22023';
    END IF;
    IF NOT (p_entity = ANY(v_tables)) THEN
        RAISE EXCEPTION 'Entidad no soportada: %', p_entity USING ERRCODE = '22023';
    END IF;

    -- PK: configuracion_negocio usa business_id (caso especial)
    IF p_entity = 'configuracion_negocio' THEN
        v_pk := 'business_id';
        v_id := p_business_id;
    ELSE
        v_pk := 'id';
        v_id := p_id;
    END IF;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'p_id es obligatorio para %', p_entity USING ERRCODE = '22023';
    END IF;

    -- Payload saneado: objeto, sin columnas generadas/protegidas
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        v_payload := '{}'::jsonb;
    ELSE
        v_payload := p_payload;
    END IF;
    -- Agregado compras: capturar detalles ANTES del filtro de columnas reales
    v_detalles := v_payload->'detalles';
    -- NOTA: 'subtotal' NO se elimina: es columna REAL en compras (001:148).
    -- Las columnas generadas (detalles_compra.subtotal, ventas_diarias.total_vendido)
    -- quedan excluidas solas por el filtro attgenerated = '' de abajo.
    v_payload := v_payload
        - 'id' - 'business_id' - 'created_at' - 'updated_at' - 'sync_rev'
        - 'total_vendido' - 'detalles';

    -- Conservar solo columnas reales y no generadas
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      INTO v_payload
      FROM jsonb_each(v_payload) e
      JOIN pg_attribute a ON a.attname = e.key
      JOIN pg_class c ON c.oid = a.attrelid AND c.relname = p_entity
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';

    IF p_op = 'insert' THEN
        -- ---------- INSERT ----------
        v_cols := ARRAY[]::text[];
        v_vals := ARRAY[]::text[];
        IF v_pk = 'business_id' THEN
            v_cols := v_cols || 'business_id';
            v_vals := v_vals || format('%L::uuid', p_business_id);
        ELSE
            v_cols := v_cols || 'id' || 'business_id';
            v_vals := v_vals || format('%L::uuid', v_id) || format('%L::uuid', p_business_id);
        END IF;

        FOR rec IN
            SELECT a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ
              FROM pg_attribute a
              JOIN pg_class c ON c.oid = a.attrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = p_entity
               AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
               AND v_payload ? a.attname
             ORDER BY a.attnum
        LOOP
            v_cols := v_cols || rec.col;
            v_vals := v_vals || format('($1::jsonb->>%L)::%s', rec.col, rec.typ);
        END LOOP;

        v_sql := format(
            'INSERT INTO %I (%s) VALUES (%s) RETURNING sync_rev',
            p_entity,
            (SELECT string_agg(quote_ident(x), ', ') FROM unnest(v_cols) AS x),
            array_to_string(v_vals, ', ')
        );

        BEGIN
            EXECUTE v_sql INTO v_rev USING v_payload;
        EXCEPTION WHEN unique_violation THEN
            -- ¿existe fila con la misma PK? -> insert_insert
            EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND business_id = $2', p_entity, v_pk)
                INTO v_server USING v_id, p_business_id;
            IF v_server IS NULL THEN
                RAISE; -- otro unique constraint (no es conflicto de sync)
            END IF;

            INSERT INTO sync_conflicts
                (business_id, table_name, row_id, kind, mutation_id, base_rev, server_version, incoming_version)
            VALUES
                (p_business_id, p_entity, v_id, 'insert_insert', p_mutation_id, p_base_rev, v_server, v_payload)
            RETURNING id INTO v_conflict_id;

            v_result := jsonb_build_object('status', 'conflict', 'kind', 'insert_insert',
                                           'server', v_server, 'id', v_conflict_id);
            INSERT INTO applied_ops (mutation_id, business_id, user_id, entity, response)
            VALUES (p_mutation_id, p_business_id, auth.uid(), p_entity, v_result);
            RETURN v_result;
        END;

        -- Agregado compras: reemplazar detalles en la misma transacción
        IF p_entity = 'compras' AND v_detalles IS NOT NULL AND jsonb_typeof(v_detalles) = 'array' THEN
            PERFORM sync_replace_compra_detalles(v_id, p_business_id, v_detalles);
        END IF;

        v_result := jsonb_build_object('status', 'ok', 'rev', v_rev);

    ELSIF p_op = 'update' THEN
        -- ---------- UPDATE (nunca upsert) ----------
        SELECT string_agg(
                   format('%I = ($1::jsonb->>%L)::%s', a.attname, a.attname,
                          format_type(a.atttypid, a.atttypmod)), ', ')
          INTO v_set
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = p_entity
           AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
           AND v_payload ? a.attname;

        IF v_set IS NULL THEN
            RAISE EXCEPTION 'Payload vacío para update en %', p_entity USING ERRCODE = '22023';
        END IF;

        EXECUTE format(
            'UPDATE %I SET %s WHERE %I = $2 AND business_id = $3 AND sync_rev = $4 RETURNING sync_rev',
            p_entity, v_set, v_pk
        ) INTO v_rev USING v_payload, v_id, p_business_id, p_base_rev;
        GET DIAGNOSTICS v_rows = ROW_COUNT;

        IF v_rows = 0 THEN
            EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND business_id = $2', p_entity, v_pk)
                INTO v_server USING v_id, p_business_id;

            IF v_server IS NOT NULL THEN
                v_kind := 'update_update';
            ELSE
                v_kind := 'delete_update';
            END IF;

            INSERT INTO sync_conflicts
                (business_id, table_name, row_id, kind, mutation_id, base_rev, server_version, incoming_version)
            VALUES
                (p_business_id, p_entity, v_id, v_kind, p_mutation_id, p_base_rev, v_server, v_payload)
            RETURNING id INTO v_conflict_id;

            v_result := jsonb_build_object('status', 'conflict', 'kind', v_kind,
                                           'server', v_server, 'id', v_conflict_id);
            INSERT INTO applied_ops (mutation_id, business_id, user_id, entity, response)
            VALUES (p_mutation_id, p_business_id, auth.uid(), p_entity, v_result);
            RETURN v_result;
        END IF;

        -- Agregado compras: reemplazar detalles en la misma transacción
        IF p_entity = 'compras' AND v_detalles IS NOT NULL AND jsonb_typeof(v_detalles) = 'array' THEN
            PERFORM sync_replace_compra_detalles(v_id, p_business_id, v_detalles);
        END IF;

        v_result := jsonb_build_object('status', 'ok', 'rev', v_rev);

    ELSE
        -- ---------- DELETE ----------
        EXECUTE format(
            'DELETE FROM %I WHERE %I = $1 AND business_id = $2 AND sync_rev = $3',
            p_entity, v_pk
        ) USING v_id, p_business_id, p_base_rev;
        GET DIAGNOSTICS v_rows = ROW_COUNT;

        IF v_rows = 0 THEN
            EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND business_id = $2', p_entity, v_pk)
                INTO v_server USING v_id, p_business_id;

            IF v_server IS NOT NULL THEN
                -- el servidor tiene una versión más nueva -> delete_update
                INSERT INTO sync_conflicts
                    (business_id, table_name, row_id, kind, mutation_id, base_rev, server_version, incoming_version)
                VALUES
                    (p_business_id, p_entity, v_id, 'delete_update', p_mutation_id, p_base_rev, v_server, NULL)
                RETURNING id INTO v_conflict_id;

                v_result := jsonb_build_object('status', 'conflict', 'kind', 'delete_update',
                                               'server', v_server, 'id', v_conflict_id);
                INSERT INTO applied_ops (mutation_id, business_id, user_id, entity, response)
                VALUES (p_mutation_id, p_business_id, auth.uid(), p_entity, v_result);
                RETURN v_result;
            END IF;

            -- no existía: delete idempotente
            v_result := jsonb_build_object('status', 'ok', 'rev', NULL);
        ELSE
            -- rev del tombstone recién creado (cursor de pull)
            SELECT d.seq INTO v_rev
              FROM sync_deletions d
             WHERE d.business_id = p_business_id
               AND d.table_name = p_entity
               AND d.row_id = v_id
             ORDER BY d.seq DESC
             LIMIT 1;
            v_result := jsonb_build_object('status', 'ok', 'rev', v_rev);
        END IF;
    END IF;

    -- Guardar respuesta para idempotencia y devolver
    INSERT INTO applied_ops (mutation_id, business_id, user_id, entity, response)
    VALUES (p_mutation_id, p_business_id, auth.uid(), p_entity, v_result);

    RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION apply_mutation(uuid, uuid, text, text, uuid, jsonb, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_mutation(uuid, uuid, text, text, uuid, jsonb, bigint) TO authenticated, service_role;

-- ============================================
-- 4.6 RPC: resolver_conflicto (una sola transacción)
-- ============================================
CREATE OR REPLACE FUNCTION resolver_conflicto(
    p_conflict_id uuid,
    p_resolution  text,
    p_payload     jsonb,
    p_mutation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_c       sync_conflicts%ROWTYPE;
    v_entity  text;
    v_pk      text;
    v_payload jsonb;
    v_set     text;
    v_rows    integer;
    v_new_id  uuid;
    v_cols    text[];
    v_vals    text[];
    rec       record;
    v_result  jsonb;
BEGIN
    SELECT * INTO v_c FROM sync_conflicts WHERE id = p_conflict_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conflicto no encontrado: %', p_conflict_id USING ERRCODE = 'P0002';
    END IF;

    -- Guard de tenant
    IF NOT (v_c.business_id = ANY(current_user_business_ids())) THEN
        RAISE EXCEPTION 'No autorizado para el conflicto %', p_conflict_id USING ERRCODE = '42501';
    END IF;

    -- Idempotencia del propio resolver
    IF v_c.resolved_at IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'already_resolved',
                                  'resolution', v_c.resolution, 'conflict_id', p_conflict_id);
    END IF;
    IF p_resolution NOT IN ('mine', 'server', 'both', 'merged') THEN
        RAISE EXCEPTION 'Resolución inválida: %', p_resolution USING ERRCODE = '22023';
    END IF;

    v_entity := v_c.table_name;
    IF v_entity = 'configuracion_negocio' THEN
        v_pk := 'business_id';
    ELSE
        v_pk := 'id';
    END IF;

    -- Payload resuelto saneado
    v_payload := COALESCE(p_payload, v_c.incoming_version, '{}'::jsonb);
    IF jsonb_typeof(v_payload) <> 'object' THEN
        v_payload := '{}'::jsonb;
    END IF;
    v_payload := v_payload
        - 'id' - 'business_id' - 'created_at' - 'updated_at' - 'sync_rev'
        - 'total_vendido';
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      INTO v_payload
      FROM jsonb_each(v_payload) e
      JOIN pg_attribute a ON a.attname = e.key
      JOIN pg_class c ON c.oid = a.attrelid AND c.relname = v_entity
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';

    IF p_resolution = 'server' THEN
        -- no-op: se conserva la versión del servidor
        NULL;

    ELSIF p_resolution = 'both' THEN
        -- insert con nuevo uuid (conservar ambas versiones)
        v_new_id := gen_random_uuid();
        v_cols := ARRAY[]::text[];
        v_vals := ARRAY[]::text[];
        IF v_pk = 'business_id' THEN
            v_cols := v_cols || 'business_id';
            v_vals := v_vals || format('%L::uuid', v_c.business_id);
        ELSE
            v_cols := v_cols || 'id' || 'business_id';
            v_vals := v_vals || format('%L::uuid', v_new_id) || format('%L::uuid', v_c.business_id);
        END IF;
        FOR rec IN
            SELECT a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ
              FROM pg_attribute a
              JOIN pg_class c ON c.oid = a.attrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = v_entity
               AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
               AND v_payload ? a.attname
             ORDER BY a.attnum
        LOOP
            v_cols := v_cols || rec.col;
            v_vals := v_vals || format('($1::jsonb->>%L)::%s', rec.col, rec.typ);
        END LOOP;
        EXECUTE format(
            'INSERT INTO %I (%s) VALUES (%s)',
            v_entity,
            (SELECT string_agg(quote_ident(x), ', ') FROM unnest(v_cols) AS x),
            array_to_string(v_vals, ', ')
        ) USING v_payload;

    ELSE
        -- 'mine' o 'merged' -> update forzado (ignora base_rev; rev actual vía trigger)
        SELECT string_agg(
                   format('%I = ($1::jsonb->>%L)::%s', a.attname, a.attname,
                          format_type(a.atttypid, a.atttypmod)), ', ')
          INTO v_set
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = v_entity
           AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
           AND v_payload ? a.attname;

        IF v_set IS NOT NULL THEN
            EXECUTE format(
                'UPDATE %I SET %s WHERE %I = $2 AND business_id = $3',
                v_entity, v_set, v_pk
            ) USING v_payload, v_c.row_id, v_c.business_id;
            GET DIAGNOSTICS v_rows = ROW_COUNT;

            -- Si la fila no existe (p. ej. delete_update), restaurar mi versión
            IF v_rows = 0 THEN
                v_cols := ARRAY[]::text[];
                v_vals := ARRAY[]::text[];
                IF v_pk = 'business_id' THEN
                    v_cols := v_cols || 'business_id';
                    v_vals := v_vals || format('%L::uuid', v_c.business_id);
                ELSE
                    v_cols := v_cols || 'id' || 'business_id';
                    v_vals := v_vals || format('%L::uuid', v_c.row_id) || format('%L::uuid', v_c.business_id);
                END IF;
                FOR rec IN
                    SELECT a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ
                      FROM pg_attribute a
                      JOIN pg_class c ON c.oid = a.attrelid
                      JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relname = v_entity
                       AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
                       AND v_payload ? a.attname
                     ORDER BY a.attnum
                LOOP
                    v_cols := v_cols || rec.col;
                    v_vals := v_vals || format('($1::jsonb->>%L)::%s', rec.col, rec.typ);
                END LOOP;
                EXECUTE format(
                    'INSERT INTO %I (%s) VALUES (%s)',
                    v_entity,
                    (SELECT string_agg(quote_ident(x), ', ') FROM unnest(v_cols) AS x),
                    array_to_string(v_vals, ', ')
                ) USING v_payload;
            END IF;
        END IF;
    END IF;

    -- Marcar resuelto (mismo transacción que el efecto)
    UPDATE sync_conflicts
       SET resolved_at      = now(),
           resolution       = p_resolution,
           resolved_payload = v_payload,
           resolved_by      = auth.uid()
     WHERE id = p_conflict_id;

    v_result := jsonb_build_object('status', 'ok', 'resolution', p_resolution,
                                   'conflict_id', p_conflict_id, 'mutation_id', p_mutation_id);

    -- Idempotencia del propio resolver
    IF p_mutation_id IS NOT NULL THEN
        INSERT INTO applied_ops (mutation_id, business_id, user_id, entity, response)
        VALUES (p_mutation_id, v_c.business_id, auth.uid(), 'resolve:' || v_entity, v_result)
        ON CONFLICT (mutation_id) DO NOTHING;
    END IF;

    RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION resolver_conflicto(uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolver_conflicto(uuid, text, jsonb, uuid) TO authenticated, service_role;

-- ============================================
-- 4.6 RPC: ajustar_stock (contador atómico)
-- ============================================
CREATE OR REPLACE FUNCTION ajustar_stock(
    p_mutation_id  uuid,
    p_producto_id  uuid,
    p_delta        integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_prev   jsonb;
    v_row    productos;
    v_result jsonb;
BEGIN
    -- Idempotencia (§4.3): repetir la respuesta exacta en reintentos,
    -- para no descontar stock dos veces si se pierde el ack.
    IF p_mutation_id IS NOT NULL THEN
        SELECT response INTO v_prev FROM applied_ops WHERE mutation_id = p_mutation_id;
        IF FOUND THEN
            RETURN v_prev;
        END IF;
    END IF;

    UPDATE productos
       SET stock = greatest(0, stock + p_delta)
     WHERE id = p_producto_id
       AND business_id = ANY(current_user_business_ids())
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado o sin acceso: %', p_producto_id USING ERRCODE = 'P0002';
    END IF;

    v_result := jsonb_build_object('status', 'ok', 'rev', v_row.sync_rev, 'stock', v_row.stock);

    IF p_mutation_id IS NOT NULL THEN
        INSERT INTO applied_ops (mutation_id, business_id, user_id, entity, response)
        VALUES (p_mutation_id, v_row.business_id, auth.uid(), 'productos', v_result);
    END IF;

    RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION ajustar_stock(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ajustar_stock(uuid, uuid, integer) TO authenticated, service_role;
