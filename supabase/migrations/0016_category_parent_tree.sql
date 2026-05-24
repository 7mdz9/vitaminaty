ALTER TABLE categories
  ADD COLUMN parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX categories_parent_id_sort_idx ON categories(parent_id, sort_order);

CREATE OR REPLACE FUNCTION admin_reorder_categories(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  changed jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'category reorder payload must be an array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(id uuid, parent_id uuid)
    WHERE item.parent_id IS NOT NULL
      AND item.parent_id = item.id
  ) THEN
    RAISE EXCEPTION 'category cannot be its own parent';
  END IF;

  WITH input_rows AS (
    SELECT id, parent_id, sort_order
    FROM jsonb_to_recordset(p_items) AS item(id uuid, parent_id uuid, sort_order int)
  ),
  before_rows AS (
    SELECT c.id, c.parent_id, c.sort_order
    FROM categories c
    JOIN input_rows input ON input.id = c.id
  ),
  updated_rows AS (
    UPDATE categories AS category
    SET
      parent_id = input.parent_id,
      sort_order = input.sort_order,
      parent_nav = COALESCE(parent.parent_nav, category.parent_nav),
      updated_at = now()
    FROM input_rows input
    LEFT JOIN categories parent ON parent.id = input.parent_id
    WHERE category.id = input.id
    RETURNING category.id, category.parent_id, category.sort_order
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'category_id', updated.id,
        'before_parent_id', before.parent_id,
        'after_parent_id', updated.parent_id,
        'before_sort_order', before.sort_order,
        'after_sort_order', updated.sort_order
      )
      ORDER BY updated.sort_order, updated.id
    ),
    '[]'::jsonb
  )
  INTO changed
  FROM updated_rows updated
  JOIN before_rows before ON before.id = updated.id;

  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION admin_reorder_categories(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_reorder_categories(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reorder_categories(jsonb) TO service_role;
