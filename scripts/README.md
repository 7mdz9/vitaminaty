# Scripts

One-shot operational scripts. Run them manually from a local shell; they are not part of `supabase db reset`.

## `import-products-from-md.ts`

Imports `docs/reference/product.md` into the local Supabase catalog using the Step 8 v1.1 content rules.

```powershell
pnpm exec tsx scripts/import-products-from-md.ts
```

## `seed-admin-user.ts`

Creates or updates the initial Supabase Auth admin user in the local Supabase stack. The user is auth-only; the script does not create a `public.customers` row. MFA enrollment is owned by M2 at first admin signin.

Required environment variables:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD` with at least 32 characters

```powershell
$env:SEED_ADMIN_EMAIL = "admin@example.test"
$env:SEED_ADMIN_PASSWORD = "<operator-generated-strong-temporary-password>"
pnpm exec tsx scripts/seed-admin-user.ts
```
