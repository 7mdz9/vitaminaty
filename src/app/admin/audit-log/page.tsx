import { AuditLogTable } from "@/features/admin-audit/components/AuditLogTable";
import { getAuditLogList, parseAuditLogSearchParams } from "@/features/admin-audit/queries";
import { auditLogActionOptions, type AuditLogListSearchParams } from "@/lib/validation/audit-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<AuditLogListSearchParams>;
}>) {
  const params = await searchParams;
  const input = parseAuditLogSearchParams(params);
  const list = await getAuditLogList(input);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Audit log</h2>
          <p className="text-admin-sm text-admin-text-muted">
            {list.total} entries · page {list.page} of {list.pageCount}
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        <form className="grid gap-2 border-b border-admin-border p-3 md:grid-cols-7">
          <Input defaultValue={params.actor ?? ""} name="actor" placeholder="Actor email or id" />
          <select
            className="h-8 rounded-admin-md border border-admin-border bg-admin-surface px-2 text-admin-sm"
            defaultValue={params.action ?? ""}
            name="action"
          >
            <option value="">All actions</option>
            {auditLogActionOptions.map((action) => (
              <option key={action} value={action}>
                {action.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Input
            defaultValue={params.entity_type ?? ""}
            name="entity_type"
            placeholder="Entity type"
          />
          <Input defaultValue={params.entity_id ?? ""} name="entity_id" placeholder="Entity id" />
          <Input defaultValue={params.date_from ?? ""} name="date_from" type="date" />
          <Input defaultValue={params.date_to ?? ""} name="date_to" type="date" />
          <Button size="sm" type="submit">
            Filter
          </Button>
        </form>
        <AuditLogTable entries={list.entries} />
        <PaginationFooter page={list.page} pageCount={list.pageCount} params={params} />
      </section>
    </div>
  );
}

function PaginationFooter({
  page,
  pageCount,
  params,
}: Readonly<{
  page: number;
  pageCount: number;
  params: AuditLogListSearchParams;
}>) {
  const previousHref = buildPageHref(params, Math.max(1, page - 1));
  const nextHref = buildPageHref(params, Math.min(pageCount, page + 1));

  return (
    <div className="flex items-center justify-between border-t border-admin-border px-3 py-2 text-admin-sm">
      <Button disabled={page <= 1} render={<a href={previousHref} />} size="sm" variant="outline">
        Previous
      </Button>
      <span className="text-admin-text-muted tabular-nums">
        {page} / {pageCount}
      </span>
      <Button
        disabled={page >= pageCount}
        render={<a href={nextHref} />}
        size="sm"
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}

function buildPageHref(params: AuditLogListSearchParams, page: number): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      next.set(key, String(value));
    }
  }

  next.set("page", String(page));

  return `/admin/audit-log?${next.toString()}`;
}
