import { HomepageEditor } from "@/features/admin-homepage/components/HomepageEditor";
import { getHomepageCurationData } from "@/features/admin-homepage/queries";

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  const data = await getHomepageCurationData();

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Homepage curation</h2>
          <p className="text-admin-sm text-admin-text-muted">
            Hero copy, promo banner, product rails, featured brands, and goal pills
          </p>
        </div>
      </header>
      <HomepageEditor
        brands={data.brands}
        config={data.config}
        goals={data.goals}
        products={data.products}
      />
    </div>
  );
}
