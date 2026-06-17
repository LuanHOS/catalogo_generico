-- 1. Checkout do Cliente: Removemos completamente o parâmetro 'order_total' que vinha do front-end
DROP FUNCTION IF EXISTS public.checkout_order(numeric, jsonb);
DROP FUNCTION IF EXISTS public.checkout_order(numeric, jsonb, text);
DROP FUNCTION IF EXISTS public.checkout_order(jsonb, text);

CREATE OR REPLACE FUNCTION public.checkout_order(order_items jsonb, p_vip_code text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id uuid;
    v_server_total numeric := 0;
    v_item jsonb;
    v_product record;
    v_final_price numeric;
    v_qty integer;
    v_final_items jsonb := '[]'::jsonb;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'A quantidade do produto deve ser maior que zero.';
        END IF;

        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::uuid;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto não encontrado.';
        END IF;

        IF NOT v_product.in_stock OR (v_product.track_stock AND v_product.stock < v_qty) THEN
            RAISE EXCEPTION 'Estoque insuficiente para %.', v_product.name;
        END IF;

        v_final_price := COALESCE(v_product.sale_price, v_product.price);
        v_server_total := v_server_total + (v_final_price * v_qty);

        -- Reconstrói o JSON com segurança para salvar a "foto" do pedido
        v_final_items := v_final_items || jsonb_build_object(
            'id', v_product.id,
            'name', v_product.name,
            'price', v_final_price,
            'quantity', v_qty
        );

        IF v_product.track_stock THEN
            UPDATE public.products 
            SET stock = stock - v_qty 
            WHERE id = v_product.id;
        END IF;
    END LOOP;

    INSERT INTO public.orders (total, items, status, vip_code)
    VALUES (v_server_total, v_final_items, 'pending', p_vip_code)
    RETURNING id INTO v_order_id;

    RETURN v_order_id::text;
END;
$$;

-- 2. Checkout Presencial (Admin): Agora aceita apenas um "discount_amount" seguro
DROP FUNCTION IF EXISTS public.checkout_presential_order(numeric, jsonb);

CREATE OR REPLACE FUNCTION public.checkout_presential_order(order_items jsonb, discount_amount numeric DEFAULT 0)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_item jsonb;
    v_product record;
    v_qty integer;
    v_server_total numeric := 0;
    v_final_price numeric;
    new_order_id uuid;
    v_final_items jsonb := '[]'::jsonb;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'A quantidade do produto deve ser maior que zero.';
        END IF;

        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::uuid;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto não encontrado.';
        END IF;

        IF NOT v_product.in_stock OR (v_product.track_stock AND v_product.stock < v_qty) THEN
            RAISE EXCEPTION 'Estoque insuficiente para %.', v_product.name;
        END IF;

        v_final_price := COALESCE(v_product.sale_price, v_product.price);
        v_server_total := v_server_total + (v_final_price * v_qty);

        v_final_items := v_final_items || jsonb_build_object(
            'id', v_product.id,
            'name', v_product.name,
            'price', v_final_price,
            'quantity', v_qty
        );

        IF v_product.track_stock THEN
            UPDATE public.products 
            SET stock = stock - v_qty 
            WHERE id = v_product.id;
        END IF;
    END LOOP;

    -- O servidor soma tudo e aplica o desconto enviado pelo admin
    v_server_total := v_server_total - discount_amount;

    INSERT INTO public.orders (total, items, status, is_presential, completed_at)
    VALUES (v_server_total, v_final_items, 'completed', TRUE, now())
    RETURNING id INTO new_order_id;
END;
$$;

-- 3. Update Order Status: Troca 'new_total' por 'p_discount_amount' para abater do valor real com segurança
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, numeric, text, text);
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text);

CREATE OR REPLACE FUNCTION public.update_order_status(order_id uuid, new_status text, p_discount_amount numeric DEFAULT NULL, p_reason text DEFAULT NULL, p_canceled_by text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order record;
    v_item jsonb;
    v_qty integer;
    v_product record;
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
            SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::uuid;
            IF FOUND AND v_product.track_stock THEN
                UPDATE public.products 
                SET stock = stock + v_qty 
                WHERE id = (v_item->>'id')::uuid;
            END IF;
        END LOOP;
    END IF;

    IF v_order.status = 'canceled' AND new_status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::uuid;
            IF FOUND AND v_product.track_stock THEN
                UPDATE public.products 
                SET stock = stock - v_qty 
                WHERE id = (v_item->>'id')::uuid;
            END IF;
        END LOOP;
    END IF;

    IF p_discount_amount IS NOT NULL THEN
        UPDATE public.orders 
        SET status = new_status, 
            total = total - p_discount_amount,
            cancellation_reason = p_reason,
            canceled_by_name = p_canceled_by,
            completed_at = CASE WHEN new_status = 'completed' THEN now() ELSE completed_at END,
            canceled_at = CASE WHEN new_status = 'canceled' THEN now() ELSE canceled_at END
        WHERE id = order_id;
    ELSE
        UPDATE public.orders 
        SET status = new_status,
            cancellation_reason = p_reason,
            canceled_by_name = p_canceled_by,
            completed_at = CASE WHEN new_status = 'completed' THEN now() ELSE completed_at END,
            canceled_at = CASE WHEN new_status = 'canceled' THEN now() ELSE canceled_at END
        WHERE id = order_id;
    END IF;
END;
$$;