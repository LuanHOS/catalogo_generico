DROP FUNCTION IF EXISTS public.update_order_status(uuid, text);

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
    -- Verifica permissão de admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado';
    END IF;

    -- Devolve estoque se o pedido for cancelado
    IF new_status = 'canceled' AND v_order.status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products 
            SET stock = stock + v_qty 
            WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    -- Remove novamente do estoque se estava cancelado e voltou para concluído/pendente
    IF v_order.status = 'canceled' AND new_status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products 
            SET stock = stock - v_qty 
            WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    -- Atualiza o total se um novo valor (com desconto) foi passado
    IF new_total IS NOT NULL THEN
        UPDATE public.orders SET status = new_status, total = new_total WHERE id = order_id;
    ELSE
        UPDATE public.orders SET status = new_status WHERE id = order_id;
    END IF;
END;
$$;