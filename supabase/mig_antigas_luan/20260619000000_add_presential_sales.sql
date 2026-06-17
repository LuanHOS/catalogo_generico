ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_presential BOOLEAN DEFAULT FALSE;

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
    -- Insere o pedido já finalizado e marcado como presencial
    INSERT INTO public.orders (total, items, status, is_presential, completed_at)
    VALUES (order_total, order_items, 'completed', TRUE, now())
    RETURNING id INTO new_order_id;

    -- Atualiza o estoque
    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        prod_id := (item->>'id')::uuid;
        qty := (item->>'quantity')::int;

        UPDATE public.products
        SET stock = stock - qty
        WHERE id = prod_id;
    END LOOP;
END;
$$;