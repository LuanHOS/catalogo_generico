-- Adiciona a coluna na tabela principal
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT TRUE;

-- Atualiza a View de segurança da loja para expor a nova coluna
DROP FUNCTION IF EXISTS get_catalog_secure(text);
CREATE OR REPLACE FUNCTION get_catalog_secure(p_code TEXT DEFAULT NULL)
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
BEGIN
    IF (SELECT value FROM app_settings WHERE key = 'private_mode') = 'true' THEN
        IF p_code IS NULL OR NOT EXISTS (SELECT 1 FROM access_codes WHERE code = p_code) THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;
    END IF;

    RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.image_url, p.price, p.sale_price, p.in_stock, p.stock, p.min_stock, p.barcode, p.max_per_cart, p.sort_order, p.created_at, p.updated_at, p.sales_count, p.track_stock
    FROM products p
    WHERE p.deleted_at IS NULL AND p.in_stock = TRUE;
END;
$$;

-- Atualiza a função de checkout do cliente para só debitar se controlar estoque
CREATE OR REPLACE FUNCTION checkout_order(order_total NUMERIC, order_items JSONB, p_vip_code TEXT DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    prod_id uuid;
    qty int;
    new_order_id uuid;
BEGIN
    INSERT INTO public.orders (total, items, status, vip_code)
    VALUES (order_total, order_items, 'pending', p_vip_code)
    RETURNING id INTO new_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        prod_id := (item->>'id')::uuid;
        qty := (item->>'quantity')::int;

        UPDATE public.products
        SET stock = stock - qty
        WHERE id = prod_id AND track_stock = TRUE;
    END LOOP;
    
    RETURN new_order_id;
END;
$$;

-- Atualiza a função de checkout manual (admin) para só debitar se controlar estoque
CREATE OR REPLACE FUNCTION checkout_presential_order(order_total NUMERIC, order_items JSONB)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    prod_id uuid;
    qty int;
    new_order_id uuid;
BEGIN
    INSERT INTO public.orders (total, items, status, is_presential, completed_at)
    VALUES (order_total, order_items, 'completed', TRUE, now())
    RETURNING id INTO new_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        prod_id := (item->>'id')::uuid;
        qty := (item->>'quantity')::int;

        UPDATE public.products
        SET stock = stock - qty
        WHERE id = prod_id AND track_stock = TRUE;
    END LOOP;
END;
$$;