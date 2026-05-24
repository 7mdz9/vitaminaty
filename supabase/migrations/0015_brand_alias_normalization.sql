CREATE OR REPLACE FUNCTION admin_add_brand_alias_and_recompute(
  p_brand_id uuid,
  p_alias text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  clean_alias text := btrim(p_alias);
  affected jsonb := '[]'::jsonb;
BEGIN
  IF clean_alias IS NULL OR clean_alias = '' THEN
    RAISE EXCEPTION 'brand alias is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM brands WHERE id = p_brand_id) THEN
    RAISE EXCEPTION 'brand not found';
  END IF;

  UPDATE brands
  SET
    aliases = COALESCE(
      ARRAY(
        SELECT DISTINCT alias_value
        FROM unnest(COALESCE(aliases, '{}'::text[]) || clean_alias) AS alias_value
        WHERE btrim(alias_value) <> ''
        ORDER BY alias_value
      ),
      '{}'::text[]
    ),
    updated_at = now()
  WHERE id = p_brand_id;

  UPDATE brands
  SET
    aliases = COALESCE(
      ARRAY(
        SELECT alias_value
        FROM unnest(COALESCE(aliases, '{}'::text[])) AS alias_value
        WHERE lower(btrim(alias_value)) <> lower(clean_alias)
        ORDER BY alias_value
      ),
      '{}'::text[]
    ),
    updated_at = now()
  WHERE id <> p_brand_id
    AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(aliases, '{}'::text[])) AS alias_value
      WHERE lower(btrim(alias_value)) = lower(clean_alias)
    );

  WITH affected_products AS (
    SELECT id, brand_id AS previous_brand_id
    FROM products
    WHERE brand_raw IS NOT NULL
      AND lower(btrim(brand_raw)) = lower(clean_alias)
  ),
  updated_products AS (
    UPDATE products AS product
    SET
      brand_id = p_brand_id,
      fields_status = jsonb_set(
        COALESCE(product.fields_status, '{}'::jsonb),
        '{brand}',
        '"complete"'::jsonb,
        true
      ),
      admin_review_flags = jsonb_set(
        COALESCE(product.admin_review_flags, '{}'::jsonb),
        '{needs_brand_review}',
        'false'::jsonb,
        true
      )
    FROM affected_products AS affected
    WHERE product.id = affected.id
    RETURNING
      product.id,
      affected.previous_brand_id,
      product.brand_id AS new_brand_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', id,
        'previous_brand_id', previous_brand_id,
        'new_brand_id', new_brand_id
      )
      ORDER BY id
    ),
    '[]'::jsonb
  )
  INTO affected
  FROM updated_products;

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION admin_add_brand_alias_and_recompute(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_add_brand_alias_and_recompute(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_add_brand_alias_and_recompute(uuid, text) TO service_role;
