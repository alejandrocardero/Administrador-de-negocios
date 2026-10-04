-- ============================================
-- 002c: FIX — create_auth_user dejaba en NULL
--        confirmation_token / recovery_token /
--        email_change / email_change_token_new.
--        GoTrue hace scan de esos campos en string
--        (no pointer) → "Database error querying
--        schema" (HTTP 500) al hacer login.
--        GoTrue los guarda como '' (empty string).
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
        confirmation_token, recovery_token, email_change, email_change_token_new,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        lower(p_email),
        crypt(p_password, gen_salt('bf')),
        now(),
        '', '', '', '',
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

-- Sanear usuarios existentes creados antes del fix
UPDATE auth.users
SET confirmation_token = coalesce(confirmation_token, ''),
    recovery_token      = coalesce(recovery_token, ''),
    email_change        = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL;
