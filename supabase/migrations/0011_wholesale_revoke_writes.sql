-- M1 Final Audit recovery: complete defense-in-depth isolation for wholesale_price_internal.
-- 0009 revoked SELECT and granted back only non-wholesale product columns to anon/authenticated.
-- This migration also removes write/reference privileges on the sensitive wholesale column.

REVOKE INSERT (wholesale_price_internal) ON TABLE products FROM anon, authenticated;
REVOKE UPDATE (wholesale_price_internal) ON TABLE products FROM anon, authenticated;
REVOKE REFERENCES (wholesale_price_internal) ON TABLE products FROM anon, authenticated;

-- PostgreSQL table-level write/reference grants imply column-level privileges in
-- information_schema.column_privileges. Remove those table-level grants for public
-- API roles too; admin/import writes use service_role repositories.
REVOKE INSERT, UPDATE, REFERENCES ON TABLE products FROM anon, authenticated;
