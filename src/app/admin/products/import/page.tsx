import { stat } from "node:fs/promises";
import Link from "next/link";
import type { ReactNode } from "react";
import { Database, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/policies";

export const dynamic = "force-dynamic";

const CATALOG_SOURCE_PATH = "docs/reference/product.md";
const IMPORT_SCRIPT_PATH = "scripts/import-products-from-md.ts";

export default async function ProductImportPage() {
  await requireAdmin();
  const source = await getSourceStatus();

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">MD Import</h2>
          <p className="text-admin-sm text-admin-text-muted">
            Local catalog import status for the canonical Markdown source.
          </p>
        </div>
        <Button render={<Link href="/admin/products" />} size="sm" variant="outline">
          Back to products
        </Button>
      </header>

      <section className="grid gap-3 xl:grid-cols-3">
        <StatusPanel
          icon={<FileText className="size-4" />}
          label="Source file"
          title={CATALOG_SOURCE_PATH}
          value={source}
        />
        <StatusPanel
          icon={<Database className="size-4" />}
          label="Canonical import"
          title="787 products"
          value="44 matched brands, 18 unmatched-brand rows"
        />
        <StatusPanel
          icon={<ShieldCheck className="size-4" />}
          label="Execution boundary"
          title="Local-only script"
          value={IMPORT_SCRIPT_PATH}
        />
      </section>

      <section className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
        <h3 className="font-admin-display text-admin-sm text-admin-text">Import Guardrails</h3>
        <div className="mt-2 grid gap-2 text-admin-sm text-admin-text-muted md:grid-cols-2">
          <p>
            The importer reads local Supabase credentials from CLI status at runtime and refuses
            non-local Supabase URLs.
          </p>
          <p>
            The current admin portal exposes status only; reruns stay in the developer-controlled
            local script path.
          </p>
        </div>
      </section>
    </div>
  );
}

function StatusPanel({
  icon,
  label,
  title,
  value,
}: Readonly<{
  icon: ReactNode;
  label: string;
  title: string;
  value: string;
}>) {
  return (
    <section className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
      <div className="flex items-center gap-2 text-admin-caption uppercase text-admin-text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-admin-display text-admin-title text-admin-text">{title}</p>
      <p className="mt-1 text-admin-sm text-admin-text-muted">{value}</p>
    </section>
  );
}

async function getSourceStatus(): Promise<string> {
  try {
    const source = await stat(CATALOG_SOURCE_PATH);
    return `Updated ${source.mtime.toISOString().slice(0, 10)}`;
  } catch {
    return "Source file not found";
  }
}
