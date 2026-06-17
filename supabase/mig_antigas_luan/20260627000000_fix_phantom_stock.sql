-- 1. Atualizar a função de Checkout (Loja) para salvar o estado do estoque (Fotografia) no momento da compra
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

        -- A MÁGICA ACONTECE AQUI: Salvamos a variável 'tracked_stock' no momento exato do clique
        v_final_items := v_final_items || jsonb_build_object(
            'id', v_product.id,
            'name', v_product.name,
            'price', v_final_price,
            'quantity', v_qty,
            'tracked_stock', COALESCE(v_product.track_stock, false)
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

-- 2. Atualizar a função de Checkout Presencial (Admin) para salvar o estado do estoque
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

        -- A MÁGICA ACONTECE AQUI: Salvamos a variável 'tracked_stock' no momento exato do clique
        v_final_items := v_final_items || jsonb_build_object(
            'id', v_product.id,
            'name', v_product.name,
            'price', v_final_price,
            'quantity', v_qty,
            'tracked_stock', COALESCE(v_product.track_stock, false)
        );

        IF v_product.track_stock THEN
            UPDATE public.products 
            SET stock = stock - v_qty 
            WHERE id = v_product.id;
        END IF;
    END LOOP;

    v_server_total := v_server_total - discount_amount;

    INSERT INTO public.orders (total, items, status, is_presential, completed_at)
    VALUES (v_server_total, v_final_items, 'completed', TRUE, now())
    RETURNING id INTO new_order_id;
END;
$$;

-- 3. Atualizar o Update Status para usar o tracked_stock da FOTO (recibo) em vez do produto atual
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
            
            -- Olha para a foto salva no recibo. Se não existir (pedidos antigos), usa a regra atual do produto (fallback).
            IF FOUND AND COALESCE((v_item->>'tracked_stock')::boolean, v_product.track_stock) THEN
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
            
            -- Mesma verificação blindada para reativar pedidos cancelados
            IF FOUND AND COALESCE((v_item->>'tracked_stock')::boolean, v_product.track_stock) THEN
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