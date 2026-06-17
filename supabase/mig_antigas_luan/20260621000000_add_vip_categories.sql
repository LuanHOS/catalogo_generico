ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;
ALTER TABLE public.access_codes ADD COLUMN IF NOT EXISTS code_type TEXT DEFAULT 'store';
ALTER TABLE public.access_codes ADD COLUMN IF NOT EXISTS unlocks_vip BOOLEAN DEFAULT FALSE;

DROP FUNCTION IF EXISTS get_catalog_secure(text);
DROP FUNCTION IF EXISTS get_catalog_secure(text, text);

CREATE OR REPLACE FUNCTION get_catalog_secure(p_store_code TEXT DEFAULT NULL, p_vip_code TEXT DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    category_id uuid,
    name text,
    description text,
    image_url text,
    price numeric,
    sale_price numeric,
    in_stock boolean,
    stock int,
    min_stock int,
    barcode text,
    max_per_cart int,
    sort_order int,
    created_at timestamptz,
    updated_at timestamptz,
    sales_count int,
    track_stock boolean
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_private_mode BOOLEAN;
    v_store_ok BOOLEAN := FALSE;
    v_vip_ok BOOLEAN := FALSE;
BEGIN
    SELECT value = 'true' INTO v_private_mode FROM app_settings WHERE key = 'private_mode';

    -- Checa a senha da loja (bloqueio total)
    IF p_store_code IS NOT NULL AND p_store_code <> '' THEN
        SELECT TRUE INTO v_store_ok FROM access_codes WHERE code = p_store_code AND code_type = 'store';
        SELECT TRUE INTO v_vip_ok FROM access_codes WHERE code = p_store_code AND unlocks_vip = TRUE;
    END IF;

    -- Checa a senha exclusiva, caso a senha da loja já não tenha liberado o VIP
    IF NOT v_vip_ok AND p_vip_code IS NOT NULL AND p_vip_code <> '' THEN
        SELECT TRUE INTO v_vip_ok FROM access_codes WHERE code = p_vip_code AND (code_type = 'vip' OR unlocks_vip = TRUE);
    END IF;

    -- Se a loja for privada, o usuário TEM que ter passado no bloqueio total
    IF v_private_mode AND NOT COALESCE(v_store_ok, FALSE) THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

    RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.image_url, p.price, p.sale_price, p.in_stock, p.stock, p.min_stock, p.barcode, p.max_per_cart, p.sort_order, p.created_at, p.updated_at, p.sales_count, p.track_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL AND p.in_stock = TRUE
      AND (COALESCE(c.is_vip, FALSE) = FALSE OR COALESCE(v_vip_ok, FALSE) = TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION verify_exclusive_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    SELECT (code_type = 'vip' OR unlocks_vip = TRUE) INTO v_valid
    FROM access_codes
    WHERE code = p_code;
    
    RETURN COALESCE(v_valid, FALSE);
END;
$$;