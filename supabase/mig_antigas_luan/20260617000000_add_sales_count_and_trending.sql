ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.get_catalog_secure(text);

CREATE FUNCTION public.get_catalog_secure(p_code text DEFAULT '')
RETURNS TABLE (
  id uuid, category_id uuid, name text, description text, image_url text,
  price numeric, sale_price numeric, in_stock boolean, stock integer,
  min_stock integer, barcode text,
  max_per_cart integer, sort_order integer, created_at timestamptz, updated_at timestamptz,
  sales_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_private_mode boolean;
    v_code_valid boolean;
    v_is_admin boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    SELECT value = 'true' INTO v_private_mode
    FROM public.app_settings
    WHERE key = 'private_mode';

    v_private_mode := COALESCE(v_private_mode, false);

    IF v_private_mode AND NOT v_is_admin THEN
        IF p_code = '' THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.access_codes 
            WHERE code = p_code
        ) INTO v_code_valid;
        
        IF NOT v_code_valid THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;
    END IF;

    RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.image_url,
           p.price, p.sale_price, p.in_stock, p.stock,
           p.min_stock, p.barcode,
           p.max_per_cart, p.sort_order, p.created_at, p.updated_at,
           p.sales_count
    FROM public.products p
    ORDER BY p.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_status(order_id uuid, new_status text, new_total numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order record;
    v_item jsonb;
    v_qty integer;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado';
    END IF;

    IF new_status = 'canceled' AND v_order.status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products 
            SET stock = stock + v_qty 
            WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    IF v_order.status = 'canceled' AND new_status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products 
            SET stock = stock - v_qty 
            WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    IF new_status = 'completed' AND v_order.status != 'completed' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products SET sales_count = sales_count + v_qty WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    IF v_order.status = 'completed' AND new_status != 'completed' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products SET sales_count = sales_count - v_qty WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    IF new_total IS NOT NULL THEN
        UPDATE public.orders SET status = new_status, total = new_total WHERE id = order_id;
    ELSE
        UPDATE public.orders SET status = new_status WHERE id = order_id;
    END IF;
END;
$$;