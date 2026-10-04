-- ============================================
-- 002b: FIX — auth.users.id no tiene DEFAULT;
--        create_auth_user debe generar el UUID.
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

-- Verificación de limpieza: no deben quedar restos del intento fallido
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'jefe@prueba.test') THEN
        RAISE EXCEPTION 'Quedó un usuario parcial de la prueba de onboarding';
    END IF;
END $$;
