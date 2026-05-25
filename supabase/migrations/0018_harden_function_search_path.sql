ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public, auth;
ALTER FUNCTION public.compute_stock_status() SET search_path = public;
