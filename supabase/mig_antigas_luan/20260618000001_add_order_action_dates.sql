-- 1. Adicionar colunas de data de ação nos pedidos
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

-- 2. Atualizar a função de status para gravar a data/hora exata da ação
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, numeric, text, text);
CREATE OR REPLACE FUNCTION public.update_order_status(
    order_id uuid, 
    new_status text, 
    new_total numeric DEFAULT NULL, 
    p_reason text DEFAULT NULL, 
    p_canceled_by text DEFAULT NULL
)
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

    -- Lógica para quando um pedido é CANCELADO
    IF new_status = 'canceled' AND v_order.status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products 
            SET stock = stock + v_qty 
            WHERE id = (v_item->>'id')::uuid;
        END LOOP;
        
        -- Atualiza os motivos do cancelamento e grava o momento exato
        UPDATE public.orders 
        SET cancellation_reason = p_reason, 
            canceled_by_name = p_canceled_by,
            canceled_at = now()
        WHERE id = order_id;
    END IF;

    -- Lógica para quando o status de um pedido cancelado é revertido (caso necessário no futuro)
    IF v_order.status = 'canceled' AND new_status != 'canceled' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products 
            SET stock = stock - v_qty 
            WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    -- Lógica para quando um pedido é CONCLUÍDO
    IF new_status = 'completed' AND v_order.status != 'completed' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products SET sales_count = sales_count + v_qty WHERE id = (v_item->>'id')::uuid;
        END LOOP;
        
        -- Grava o momento exato em que foi concluído
        UPDATE public.orders SET completed_at = now() WHERE id = order_id;
    END IF;

    -- Lógica para quando o status de um pedido concluído é revertido
    IF v_order.status = 'completed' AND new_status != 'completed' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
            v_qty := (v_item->>'quantity')::integer;
            UPDATE public.products SET sales_count = sales_count - v_qty WHERE id = (v_item->>'id')::uuid;
        END LOOP;
    END IF;

    -- Atualiza finalmente o status e, opcionalmente, o total
    IF new_total IS NOT NULL THEN
        UPDATE public.orders SET status = new_status, total = new_total WHERE id = order_id;
    ELSE
        UPDATE public.orders SET status = new_status WHERE id = order_id;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';