import { describe, expect, it } from "vitest";
import {
  calculateCompletionScore,
  TIER_1_SCORED_FIELDS,
  TIER_2_SCORED_FIELDS,
  TIER_3_SCORED_FIELDS,
} from "@/features/admin-products/completion-score";
import type { ProductRecord } from "@/types/product";

describe("completion_score", () => {
  it("emptyProduct -> 0", () => {
    expect(calculateCompletionScore(productFactory()).score).toBe(0);
  });

  it("allMVPComplete -> 66", () => {
    const result = calculateCompletionScore({
      ...mvpCompleteProduct(),
      goal_tag_count: 1,
      image_count: 1,
      additional_image_count: 0,
    });

    expect(result.rawPreClampValue).toBe(66);
    expect(result.score).toBe(66);
  });

  it("allComplete -> 100", () => {
    expect(calculateCompletionScore(withCompleteCounts(fullCompleteProduct())).score).toBe(100);
  });

  it("allCompleteMinus9Flags -> 60", () => {
    const product = fullCompleteProduct({
      admin_review_flags: {
        missing_price: true,
        missing_image: true,
        missing_stock_quantity: true,
        case_pack: true,
        duplicate_suspected: true,
        multiple_price_pairs: true,
        needs_category_review: true,
        needs_brand_review: true,
        needs_label_data: true,
      },
    });

    expect(calculateCompletionScore(withCompleteCounts(product)).score).toBe(60);
  });

  it("allCompleteZeroFlags -> 100 and rawPreClampValue === 105", () => {
    const result = calculateCompletionScore(withCompleteCounts(fullCompleteProduct()));

    expect(result.rawPreClampValue).toBe(105);
    expect(result.score).toBe(100);
  });

  it("counts nutrition_panel when the field is complete or verified", () => {
    const verified = calculateCompletionScore(
      withCompleteCounts(
        fullCompleteProduct({
          fields_status: {
            ...fullCompleteProduct().fields_status,
            nutrition_panel: "verified",
          },
        }),
      ),
    );
    const complete = calculateCompletionScore(
      withCompleteCounts(
        fullCompleteProduct({
          fields_status: {
            ...fullCompleteProduct().fields_status,
            nutrition_panel: "complete",
          },
        }),
      ),
    );

    expect(verified.tier3Complete).toBe(TIER_3_SCORED_FIELDS.length);
    expect(complete.tier3Complete).toBe(TIER_3_SCORED_FIELDS.length);
  });

  it("code constants match the approved section 22.1.1 field lists", () => {
    expect(TIER_1_SCORED_FIELDS).toEqual([
      "name_raw",
      "name",
      "brand_raw",
      "source_category",
      "source_row",
      "source_file",
    ]);
    expect(TIER_2_SCORED_FIELDS).toEqual([
      "brand",
      "category",
      "form",
      "retail_price",
      "goal_tags",
      "image",
    ]);
    expect(TIER_3_SCORED_FIELDS).toEqual([
      "description",
      "benefits",
      "directions",
      "warnings",
      "storage",
      "nutrition_panel",
      "ingredients",
      "allergens",
      "seo_title",
      "seo_description",
      "additional_images",
      "often_bought_with",
      "manufacturer_country",
    ]);
  });
});

function mvpCompleteProduct(overrides: Partial<ProductRecord> = {}) {
  return productFactory({
    name_raw: "Raw Whey",
    name: "Raw Whey",
    brand_raw: "Brand",
    source_category: "Proteins",
    source_row: [1],
    source_file: "product.md",
    brand_id: "00000000-0000-4000-8000-000000000010",
    category_id: "00000000-0000-4000-8000-000000000011",
    form: "powder",
    retail_price_aed: 100,
    fields_status: {
      ...emptyFields(),
      brand: "complete",
      category: "complete",
      form: "complete",
      retail_price: "complete",
      image: "complete",
    },
    ...overrides,
  });
}

function fullCompleteProduct(overrides: Partial<ProductRecord> = {}) {
  return mvpCompleteProduct({
    content: {
      description: "A complete description.",
      benefits: ["Benefit one", "Benefit two", "Benefit three"],
      directions_of_use: "Use daily.",
      storage_instructions: "Store cool.",
      warnings: "Keep away from children.",
      seo_title: "SEO title",
      seo_description: "SEO description",
      often_bought_with_ids: ["00000000-0000-4000-8000-000000000012"],
      manufacturer_country: "UAE",
    },
    label_data: {
      nutrition_panel: { panel_type: "nutrition_facts" },
      ingredients: "Whey protein",
      allergens: ["milk"],
    },
    fields_status: {
      ...emptyFields(),
      brand: "complete",
      category: "complete",
      form: "complete",
      retail_price: "complete",
      image: "complete",
      description: "complete",
      benefits: "complete",
      directions: "complete",
      warnings: "complete",
      storage: "complete",
      nutrition_panel: "verified",
      ingredients: "verified",
      allergens: "complete",
      seo_title: "complete",
      seo_description: "complete",
      often_bought_with: "complete",
    },
    ...overrides,
  });
}

function withCompleteCounts(product: ProductRecord) {
  return {
    ...product,
    goal_tag_count: 1,
    image_count: 1,
    additional_image_count: 1,
  };
}

function productFactory(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-product",
    name: "",
    name_raw: "",
    brand_id: null,
    brand_raw: null,
    category_id: null,
    source_category: null,
    form: null,
    source_file: "",
    source_row: [],
    source_notes: null,
    retail_price_aed: null,
    wholesale_price_internal: null,
    compare_at_price_aed: null,
    status: "imported",
    is_public_visible: false,
    is_add_to_cart_enabled: false,
    is_checkout_enabled: false,
    completion_score: 0,
    featured_score: 0,
    content: {},
    label_data: {},
    fields_status: emptyFields(),
    admin_review_flags: {},
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T10:00:00.000Z",
    published_at: null,
    ...overrides,
  };
}

function emptyFields(): ProductRecord["fields_status"] {
  return {
    name: "missing",
    brand: "missing",
    category: "missing",
    form: "missing",
    retail_price: "missing",
    description: "missing",
    benefits: "missing",
    image: "missing",
    nutrition_panel: "missing",
    ingredients: "missing",
    allergens: "missing",
    directions: "missing",
    warnings: "missing",
    storage: "missing",
    seo_title: "missing",
    seo_description: "missing",
    often_bought_with: "missing",
  };
}
