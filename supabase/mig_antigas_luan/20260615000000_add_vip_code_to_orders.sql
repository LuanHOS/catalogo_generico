-- 1. Adiciona a coluna para salvar o código VIP no pedido
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vip_code text;

-- 2. Remove a função antiga de checkout para podermos mudar os parâmetros dela
DROP FUNCTION IF EXISTS public.checkout_order(numeric, jsonb);

-- 3. Recria a função agora recebendo e salvando o "p_vip_code"
CREATE OR REPLACE FUNCTION public.checkout_order(order_total numeric, order_items jsonb, p_vip_code text DEFAULT NULL)
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

    -- Cria o pedido com o valor calculado internamente e o código VIP
    INSERT INTO public.orders (total, items, status, vip_code)
    VALUES (v_server_total, order_items, 'pending', p_vip_code)
    RETURNING id INTO v_order_id;

    RETURN v_order_id::text;
END;
$$;

NOTIFY pgrst, 'reload schema';