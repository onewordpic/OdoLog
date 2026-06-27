
-- Trigger helpers: only the database itself needs to invoke these.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Public-garage RPCs: invoked from the server (service_role) only.
REVOKE EXECUTE ON FUNCTION public.get_public_garage(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_garage_stats(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_garage(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_garage_stats(text) TO service_role;
