-- Adiciona o controle de estoque real na tabela de produtos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;

-- Cria a tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    status text not null default 'pending', -- pending, completed, canceled
    total numeric not null,
    items jsonb not null
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/editar os pedidos
CREATE POLICY "Admins can manage orders"
    ON public.orders FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- Função segura (RPC) para o cliente criar o pedido do catálogo público.
-- Ela insere o pedido e já deduz o estoque em uma única transação de forma segura.
CREATE OR REPLACE FUNCTION public.checkout_order(order_total numeric, order_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id uuid;
    item jsonb;
    prod_id uuid;
    qty integer;
BEGIN
    INSERT INTO public.orders (total, items, status)
    VALUES (order_total, order_items, 'pending')
    RETURNING id INTO new_order_id;

    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        prod_id := (item->>'id')::uuid;
        qty := (item->>'quantity')::integer;

        -- Diminui o estoque e garante que não fique menor que zero
        UPDATE public.products
        SET stock = GREATEST(stock - qty, 0)
        WHERE id = prod_id;
    END LOOP;

    RETURN new_order_id;
END;
$$;

-- Função (RPC) para o admin atualizar o status do pedido.
-- Ela devolve o estoque caso um pedido seja cancelado!
CREATE OR REPLACE FUNCTION public.update_order_status(order_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    curr_status text;
    order_items jsonb;
    item jsonb;
    prod_id uuid;
    qty integer;
BEGIN
    SELECT status, items INTO curr_status, order_items FROM public.orders WHERE id = order_id;
    
    IF curr_status = new_status THEN
        RETURN;
    END IF;

    UPDATE public.orders SET status = new_status WHERE id = order_id;

    -- Se está mudando PARA cancelado, devolve os itens para o estoque
    IF new_status = 'canceled' AND curr_status != 'canceled' THEN
        FOR item IN SELECT * FROM jsonb_array_elements(order_items)
        LOOP
            prod_id := (item->>'id')::uuid;
            qty := (item->>'quantity')::integer;
            UPDATE public.products SET stock = stock + qty WHERE id = prod_id;
        END LOOP;
    END IF;

    -- Se era cancelado e voltou para pendente/concluído, tira do estoque de novo
    IF curr_status = 'canceled' AND (new_status = 'pending' OR new_status = 'completed') THEN
        FOR item IN SELECT * FROM jsonb_array_elements(order_items)
        LOOP
            prod_id := (item->>'id')::uuid;
            qty := (item->>'quantity')::integer;
            UPDATE public.products SET stock = GREATEST(stock - qty, 0) WHERE id = prod_id;
        END LOOP;
    END IF;
END;
$$;