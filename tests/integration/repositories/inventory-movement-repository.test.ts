import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types.generated";
import { createLocalAdminClient } from "../../fixtures/customers";

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

let adminClient: SupabaseClient<Database>;
let ledgerProductId: string;
let ledgerVariantId: string;
let ledgerOrderId: string;
let triggerProductId: string;
let triggerVariantId: string;

describe("inventory-movement-repository", () => {
  beforeAll(async () => {
    adminClient = createLocalAdminClient();
    ledgerProductId = await createProduct("ledger");
    ledgerVariantId = await createVariant(ledgerProductId, "Ledger", "1 kg", 10);
    ledgerOrderId = await createOrder(`ledger-${runId}`);
  });

  afterAll(async () => {
    await cleanupRows();
  });

  it("appends movements and lists them by variant and product in reverse chronological order", async () => {
    const { appendMovement, listMovementsForProduct, listMovementsForVariant } =
      await import("@/server/repositories/inventory-movement-repository");

    const older = await appendMovement(
      {
        product_id: ledgerProductId,
        variant_id: ledgerVariantId,
        previous_quantity: 10,
        new_quantity: 8,
        change_amount: -2,
        reason: "manual_adjustment",
        change_reason_note: "integration test older movement",
        changed_at: "2026-05-23T08:00:00.000Z",
      },
      adminClient,
    );
    const newer = await appendMovement(
      {
        product_id: ledgerProductId,
        variant_id: ledgerVariantId,
        previous_quantity: 8,
        new_quantity: 5,
        change_amount: -3,
        reason: "order_placed",
        order_id: ledgerOrderId,
        changed_at: "2026-05-23T09:00:00.000Z",
      },
      adminClient,
    );

    await expect(listMovementsForVariant(ledgerVariantId, adminClient)).resolves.toMatchObject([
      { id: newer.id },
      { id: older.id },
    ]);
    await expect(listMovementsForProduct(ledgerProductId, adminClient)).resolves.toMatchObject([
      { id: newer.id },
      { id: older.id },
    ]);
  });

  it("lists movements by order", async () => {
    const { listMovementsForOrder } =
      await import("@/server/repositories/inventory-movement-repository");

    await expect(listMovementsForOrder(ledgerOrderId, adminClient)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          order_id: ledgerOrderId,
          reason: "order_placed",
        }),
      ]),
    );
  });

  it("does not expose update or delete mutation functions", async () => {
    const repository = await import("@/server/repositories/inventory-movement-repository");

    expect("update" in repository).toBe(false);
    expect("delete" in repository).toBe(false);
    expect("updateMovement" in repository).toBe(false);
    expect("deleteMovement" in repository).toBe(false);
  });
});

describe.sequential("compute_stock_status trigger", () => {
  beforeAll(async () => {
    adminClient = createLocalAdminClient();
    triggerProductId = await createProduct("trigger");
    triggerVariantId = await createVariant(triggerProductId, "Trigger", "500 g", null);
  });

  afterAll(async () => {
    await cleanupRows();
  });

  it("compute_stock_status maps NULL quantity to out_of_stock", async () => {
    await expect(readStockStatus(triggerVariantId)).resolves.toBe("out_of_stock");
  });

  it("compute_stock_status maps zero quantity to out_of_stock", async () => {
    await updateVariantStock(triggerVariantId, { stock_quantity: 0 });

    await expect(readStockStatus(triggerVariantId)).resolves.toBe("out_of_stock");
  });

  it("compute_stock_status maps quantity at or below threshold to low_stock", async () => {
    await updateVariantStock(triggerVariantId, { stock_quantity: 3, low_stock_threshold: 5 });

    await expect(readStockStatus(triggerVariantId)).resolves.toBe("low_stock");
  });

  it("compute_stock_status maps quantity above threshold to in_stock", async () => {
    await updateVariantStock(triggerVariantId, { stock_quantity: 50, low_stock_threshold: 5 });

    await expect(readStockStatus(triggerVariantId)).resolves.toBe("in_stock");
  });

  it("compute_stock_status recomputes when only the threshold changes", async () => {
    await updateVariantStock(triggerVariantId, { low_stock_threshold: 100 });

    await expect(readStockStatus(triggerVariantId)).resolves.toBe("low_stock");
  });
});

async function createProduct(marker: string): Promise<string> {
  const { data, error } = await adminClient
    .from("products")
    .insert({
      slug: `inventory-${marker}-${runId}`,
      name: `Inventory ${marker} ${runId}`,
      name_raw: `Inventory ${marker} ${runId}`,
      source_file: "inventory-movement-repository.test.ts",
      source_row: [1],
      admin_review_flags: { missing_stock_quantity: false },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create inventory test product: ${error.message}`);
  }

  return data.id;
}

async function createVariant(
  productId: string,
  flavor: string,
  size: string,
  stockQuantity: number | null,
): Promise<string> {
  const { data, error } = await adminClient
    .from("product_variants")
    .insert({
      product_id: productId,
      flavor,
      size,
      price_aed: 100,
      stock_quantity: stockQuantity,
      low_stock_threshold: 5,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create inventory test variant: ${error.message}`);
  }

  return data.id;
}

async function createOrder(marker: string): Promise<string> {
  const { data, error } = await adminClient
    .from("orders")
    .insert({
      customer_id: null,
      ship_to: {
        recipient_name: "Inventory Test",
        phone_e164: "+971501111111",
        line1: "Inventory Test Tower",
        line2: null,
        city: "Dubai",
        emirate: "Dubai",
        country_code: "AE",
      },
      subtotal_aed: 100,
      shipping_cost_aed: 0,
      vat_amount_aed: 0,
      total_aed: 100,
      payment_method: "card",
      payment_provider: "stub",
      shipping_method: "standard",
      shipping_provider: "stub",
      idempotency_key: `inventory-idem-${marker}`,
      reference: `INV-${marker}`,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create inventory test order: ${error.message}`);
  }

  return data.id;
}

async function updateVariantStock(
  variantId: string,
  patch: Pick<
    Database["public"]["Tables"]["product_variants"]["Update"],
    "stock_quantity" | "low_stock_threshold"
  >,
): Promise<void> {
  const { error } = await adminClient
    .from("product_variants")
    .update(patch)
    .eq("id", variantId);

  if (error) {
    throw new Error(`Could not update inventory test variant: ${error.message}`);
  }
}

async function readStockStatus(variantId: string): Promise<string> {
  const { data, error } = await adminClient
    .from("product_variants")
    .select("stock_status")
    .eq("id", variantId)
    .single();

  if (error) {
    throw new Error(`Could not read inventory test variant: ${error.message}`);
  }

  return data.stock_status;
}

async function cleanupRows(): Promise<void> {
  if (ledgerOrderId) {
    await adminClient.from("inventory_movements").delete().eq("order_id", ledgerOrderId);
    await adminClient.from("orders").delete().eq("id", ledgerOrderId);
  }

  for (const productId of [ledgerProductId, triggerProductId].filter(Boolean)) {
    await adminClient.from("inventory_movements").delete().eq("product_id", productId);
    await adminClient.from("products").delete().eq("id", productId);
  }
}
