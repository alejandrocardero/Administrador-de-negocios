-- ============================================================================
-- 008: AUDIT LOGS TABLE
-- Tabla de auditoría de seguridad con RLS por membresía
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Tipo de evento
    event_type TEXT NOT NULL,
    
    -- Usuario que realizó la acción (puede ser null para eventos anónimos como login_failed)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Negocio al que pertenece el evento
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    
    -- Usuario objetivo (para acciones sobre otros usuarios)
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Negocio objetivo (para cambios de negocio)
    target_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    
    -- Información de red
    ip_address INET,
    user_agent TEXT,
    
    -- Detalles adicionales en JSON
    details JSONB DEFAULT '{}',
    
    -- Severidad del evento
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs (business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_business ON audit_logs (business_id, created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver logs de sus propios negocios
DROP POLICY IF EXISTS "audit_logs_business_isolation" ON audit_logs;
CREATE POLICY "audit_logs_business_isolation" ON audit_logs
    FOR SELECT
    USING (
        business_id = ANY(current_user_business_ids())
    );

-- Política: Solo service_role puede insertar (desde edge functions)
-- Los clientes NO deben insertar directamente; usan RPC/edge functions
DROP POLICY IF EXISTS "audit_logs_service_insert" ON audit_logs;
CREATE POLICY "audit_logs_service_insert" ON audit_logs
    FOR INSERT
    WITH CHECK (false); -- Solo service_role bypassa RLS

-- Política: Nadie puede actualizar o eliminar logs de auditoría
DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update" ON audit_logs
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete" ON audit_logs
    FOR DELETE USING (false);

-- ============================================================================
-- FUNCIÓN RPC PARA INSERTAR LOGS (accesible desde cliente con anon key)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
    p_event_type TEXT,
    p_user_id UUID DEFAULT NULL,
    p_business_id UUID DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_target_business_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_severity TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validar severidad
    IF p_severity NOT IN ('info', 'warning', 'error', 'critical') THEN
        RAISE EXCEPTION 'Severidad inválida: %', p_severity;
    END IF;

    -- Validar event_type no vacío
    IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
        RAISE EXCEPTION 'event_type es obligatorio';
    END IF;

    -- Insertar log
    INSERT INTO audit_logs (
        event_type,
        user_id,
        business_id,
        target_user_id,
        target_business_id,
        ip_address,
        user_agent,
        details,
        severity
    ) VALUES (
        p_event_type,
        p_user_id,
        p_business_id,
        p_target_user_id,
        p_target_business_id,
        p_ip_address,
        p_user_agent,
        p_details,
        p_severity
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log el error pero no fallar la request principal
        RAISE NOTICE 'Audit log failed: %', SQLERRM;
        -- No re-lanzar para no romper la operación principal
END;
$$;

REVOKE ALL ON FUNCTION log_audit_event(TEXT, UUID, UUID, UUID, UUID, INET, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, UUID, UUID, UUID, UUID, INET, TEXT, JSONB, TEXT) TO anon, authenticated;

-- ============================================================================
-- FUNCIÓN PARA LIMPIEZA AUTOMÁTICA (ejecutar via pg_cron o job externo)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(p_retention_days INT DEFAULT 365)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < now() - (p_retention_days || ' days')::interval;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_old_audit_logs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs(INT) TO service_role;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Log de auditoría de seguridad - Solo INSERT via service_role, SELECT por RLS';
COMMENT ON COLUMN audit_logs.event_type IS 'Tipo de evento: login_success, login_failed, logout, password_change, etc.';
COMMENT ON COLUMN audit_logs.severity IS 'info, warning, error, critical';
COMMENT ON FUNCTION log_audit_event IS 'Función para insertar logs de auditoría desde cliente (anon key)';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Limpieza de logs antiguos - Solo service_role';