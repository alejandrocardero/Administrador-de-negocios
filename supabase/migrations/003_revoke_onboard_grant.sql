-- Revoke anon access to the onboard_business RPC.
-- Anyone holding the anon key could create businesses as owner via RPC.
-- authenticated users retain access (app onboards via supabase.rpc directly).
-- Edge function supabase/functions/onboard-business is currently orphaned
-- (0 invocations in codebase); the RPC path is the live path.
-- If the edge function is wired in the future, it will use service_role
-- and bypass this GRANT anyway.

REVOKE EXECUTE ON FUNCTION onboard_business(
  TEXT,       -- p_owner_email
  TEXT,       -- p_business_name
  TEXT,       -- p_business_slug
  TEXT,       -- p_owner_password
  TEXT,       -- p_owner_full_name
  TEXT,       -- p_owner_phone
  TEXT,       -- p_business_address
  NUMERIC,    -- p_tax_rate
  TEXT,       -- p_currency
  TEXT,       -- p_timezone
  TEXT,       -- p_plan
  TEXT,       -- p_subscription_status
  JSONB       -- p_settings
) FROM anon;
