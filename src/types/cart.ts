export interface CartLineInput {
  product_id: string;
  variant_id?: string;
  quantity: number;
}

export interface CartRevalidationResult {
  lines: CartLineInput[];
  subtotal_aed: number;
  vat_amount_aed: number;
  total_aed: number;
  // TODO(M4): Add stock, price-change, and checkout eligibility diagnostics.
}
