-- 1. Adicionando a coluna de estoque que faltava na tabela de produtos originais
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;

-- 2. Criação da tabela de Pedidos (Orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    total numeric(10,2) NOT NULL DEFAULT 0,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins manage orders'
    ) THEN
        CREATE POLICY "Admins manage orders" ON public.orders
            FOR ALL TO authenticated
            USING (public.has_role(auth.uid(), 'admin'))
            WITH CHECK (public.has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

-- 3. Função RPC: checkout_order (Com cálculo de preço e dedução de estoque 100% no servidor)
CREATE OR REPLACE FUNCTION public.checkout_order(order_total numeric, order_items jsonb)
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
BEGIN
    -- Validação atômica e recálculo de preços no servidor
    FOR v_item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'A quantidade do produto deve ser maior que zero.';
        END IF;

        -- Busca o produto garantindo que ele existe
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::uuid;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto não encontrado no catálogo oficial.';
        END IF;

        -- Trava de estoque atômica
        IF NOT v_product.in_stock OR v_product.stock < v_qty THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto %.', v_product.name;
        END IF;

        -- Usa o preço do banco de dados ignorando o enviado pelo cliente
        v_final_price := COALESCE(v_product.sale_price, v_product.price);
        v_server_total := v_server_total + (v_final_price * v_qty);

        -- Deduz o estoque imediatamente
        UPDATE public.products 
        SET stock = stock - v_qty 
        WHERE id = v_product.id;
    END LOOP;

    -- Cria o pedido com o valor calculado internamente
    INSERT INTO public.orders (total, items, status)
    VALUES (v_server_total, order_items, 'pending')
    RETURNING id INTO v_order_id;

    RETURN v_order_id::text;
END;
$$;

-- 4. Função RPC: update_order_status (Com devolução de estoque automática em cancelamentos)
CREATE OR REPLACE FUNCTION public.update_order_status(order_id uuid, new_status text)
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

    UPDATE public.orders SET status = new_status WHERE id = order_id;
END;
$$;