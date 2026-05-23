export type ProductStatus =
  | "imported"
  | "draft"
  | "partial"
  | "ready_to_publish"
  | "published"
  | "hidden"
  | "archived";

export type FieldStatus =
  | { status: "complete" }
  | { status: "verified" }
  | { status: "draft" }
  | { status: "missing" }
  | { status: "needs_review" }
  | { status: "not_applicable" };

export type FieldStatusValue = FieldStatus["status"];

export type ProductForm =
  | "powder"
  | "capsule"
  | "tablet"
  | "softgel"
  | "gummies"
  | "liquid"
  | "rtd"
  | "food";

export type ProductFieldStatusKey =
  | "name"
  | "brand"
  | "category"
  | "form"
  | "retail_price"
  | "description"
  | "benefits"
  | "image"
  | "nutrition_panel"
  | "ingredients"
  | "allergens"
  | "directions"
  | "warnings"
  | "storage"
  | "seo_title"
  | "seo_description"
  | "often_bought_with";

export type ProductFieldsStatus = Record<ProductFieldStatusKey, FieldStatusValue>;

export type ProductAdminReviewFlags = Partial<
  Record<
    | "missing_price"
    | "missing_image"
    | "case_pack"
    | "duplicate_suspected"
    | "multiple_price_pairs"
    | "needs_category_review"
    | "needs_brand_review"
    | "needs_label_data",
    boolean
  >
>;

export type ProductImageKind =
  | "front"
  | "label_nutrition"
  | "label_ingredients"
  | "angle"
  | "open"
  | "lifestyle";

export interface ProductImageRecord {
  id: string;
  product_id: string;
  variant_id: string | null;
  storage_path: string;
  public_url: string;
  alt_text: string;
  kind: ProductImageKind;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariantRecord {
  id: string;
  product_id: string;
  flavor: string | null;
  size: string;
  sku: string | null;
  barcode: string | null;
  price_aed: number;
  in_stock: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number;
  weight_grams: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductGoalTagRecord {
  product_id: string;
  goal: "build_muscle" | "boost_energy" | "recovery" | "weight_management" | "endurance";
  is_primary: boolean;
}

export interface SlugHistoryRecord {
  id: string;
  product_id: string;
  old_slug: string;
  new_slug: string;
  changed_at: string;
}

export interface ProductContent {
  description?: string;
  benefits?: string[];
  directions_of_use?: string;
  storage_instructions?: string;
  warnings?: string;
  seo_title?: string;
  seo_description?: string;
  often_bought_with_ids?: string[];
  manufacturer_country?: string;
  authorized_distributor_note?: string;
}

export interface ProductLabelData {
  nutrition_panel?: Record<string, unknown>;
  ingredients?: string;
  allergens?: string[];
  manufacturing_facility_warnings?: string[];
  serving_size?: string;
  servings_per_container?: string;
}

export interface ProductRecord {
  id: string;
  slug: string;
  name: string;
  name_raw: string;
  brand_id: string | null;
  brand_raw: string | null;
  category_id: string | null;
  source_category: string | null;
  form: ProductForm | null;
  source_file: string;
  source_row: number[];
  source_notes: string | null;
  retail_price_aed: number | null;
  wholesale_price_internal: number | null;
  compare_at_price_aed: number | null;
  status: ProductStatus;
  is_public_visible: boolean;
  is_add_to_cart_enabled: boolean;
  is_checkout_enabled: boolean;
  completion_score: number;
  featured_score: number;
  content: ProductContent;
  label_data: ProductLabelData;
  fields_status: ProductFieldsStatus;
  admin_review_flags: ProductAdminReviewFlags;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export type PublicProductRecord = Omit<ProductRecord, "wholesale_price_internal">;
