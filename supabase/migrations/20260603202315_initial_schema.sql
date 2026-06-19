-- ==============================================================================
-- 1. TIPOS
-- ==============================================================================

CREATE TYPE public.app_role AS ENUM ('admin');

-- ==============================================================================
-- 2. CRIAÇÃO DAS TABELAS (Com todas as colunas finais)
-- ==============================================================================

-- 2.1. User Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  is_master boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 2.2. App Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.3. Access Codes
CREATE TABLE IF NOT EXISTS public.access_codes (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    code_type TEXT DEFAULT 'store',
    unlocks_vip BOOLEAN DEFAULT FALSE,
    created_at timestamptz default now()
);

-- 2.4. Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_vip BOOLEAN DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by_name text,
  deleted_by_name text
);

-- 2.5. Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  sale_price numeric,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  in_stock boolean NOT NULL DEFAULT true,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  track_stock BOOLEAN DEFAULT TRUE,
  barcode text,
  max_per_cart int NOT NULL DEFAULT 99,
  sort_order int NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by_name text,
  deleted_by_name text
);

-- 2.6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    total numeric(10,2) NOT NULL DEFAULT 0,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    vip_code text,
    is_presential BOOLEAN DEFAULT FALSE,
    cancellation_reason text,
    canceled_by_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    canceled_at timestamptz
);

-- ==============================================================================
-- 3. FUNÇÕES AUXILIARES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


-- ==============================================================================
-- 4. PERMISSÕES BÁSICAS (GRANTS)
-- ==============================================================================

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT SELECT ON public.access_codes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;

GRANT SELECT ON public.orders TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;


-- ==============================================================================
-- 5. TRIGGERS
-- ==============================================================================

CREATE TRIGGER tg_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- ==============================================================================
-- 6. ROW LEVEL SECURITY E POLICIES
-- ==============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- User Roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- App Settings
CREATE POLICY "Settings are public" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Access Codes
CREATE POLICY "Admins can manage access codes" ON public.access_codes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Categories
CREATE POLICY "Categories are public" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Products
CREATE POLICY "Products are public" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Orders
CREATE POLICY "Admins manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ==============================================================================
-- 7. STORAGE (Imagens dos Produtos)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admins upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));


-- ==============================================================================
-- 8. VIEWS (Catálogo Ativo) E SUAS PERMISSÕES
-- ==============================================================================

CREATE OR REPLACE VIEW active_products AS
SELECT * FROM products WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_categories AS
SELECT * FROM categories WHERE deleted_at IS NULL;

-- Permissões das views para a API conseguir ler os dados no front-end
GRANT SELECT ON public.active_products TO anon, authenticated;
GRANT ALL ON public.active_products TO service_role;

GRANT SELECT ON public.active_categories TO anon, authenticated;
GRANT ALL ON public.active_categories TO service_role;


-- ==============================================================================
-- 9. FUNÇÕES RPC (Versões finais combinadas da regra de negócio)
-- ==============================================================================

-- 9.1. Obter catálogo de forma segura (com suporte a senha, admin bypass e soft delete)
CREATE OR REPLACE FUNCTION public.get_catalog_secure(p_store_code TEXT DEFAULT NULL, p_vip_code TEXT DEFAULT NULL)
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
DECLARE
    v_private_mode BOOLEAN;
    v_store_ok BOOLEAN := FALSE;
    v_vip_ok BOOLEAN := FALSE;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') INTO v_is_admin;
    END IF;

    IF v_is_admin THEN
        v_store_ok := TRUE;
        v_vip_ok := TRUE;
    END IF;

    SELECT value = 'true' INTO v_private_mode FROM app_settings WHERE key = 'private_mode';

    IF NOT v_store_ok AND p_store_code IS NOT NULL AND p_store_code <> '' THEN
        SELECT TRUE INTO v_store_ok FROM access_codes WHERE code = p_store_code AND code_type = 'store';
        SELECT TRUE INTO v_vip_ok FROM access_codes WHERE code = p_store_code AND unlocks_vip = TRUE;
    END IF;

    IF NOT v_vip_ok AND p_vip_code IS NOT NULL AND p_vip_code <> '' THEN
        SELECT TRUE INTO v_vip_ok FROM access_codes WHERE code = p_vip_code AND (code_type = 'vip' OR unlocks_vip = TRUE);
    END IF;

    IF v_private_mode AND NOT COALESCE(v_store_ok, FALSE) THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

    RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.image_url, p.price, p.sale_price, p.in_stock, p.stock, p.min_stock, p.barcode, p.max_per_cart, p.sort_order, p.created_at, p.updated_at, p.sales_count, p.track_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL AND p.in_stock = TRUE
      AND (COALESCE(c.is_vip, FALSE) = FALSE OR COALESCE(v_vip_ok, FALSE) = TRUE);
END;
$$;


-- 9.2. Checar validade de senha exclusiva
CREATE OR REPLACE FUNCTION public.verify_exclusive_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    SELECT (code_type = 'vip' OR unlocks_vip = TRUE) INTO v_valid
    FROM access_codes
    WHERE code = p_code;
    
    RETURN COALESCE(v_valid, FALSE);
END;
$$;


-- 9.3. Checar se existem códigos VIP criados
CREATE OR REPLACE FUNCTION public.has_vip_codes()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM access_codes WHERE code_type = 'vip' OR unlocks_vip = TRUE) INTO v_exists;
    RETURN COALESCE(v_exists, FALSE);
END;
$$;


-- 9.4. Validar se a loja está em modo VIP ativo (tem produtos VIP e tem senha VIP)
CREATE OR REPLACE FUNCTION public.check_vip_status()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_has_codes BOOLEAN;
    v_has_products BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM access_codes WHERE code_type = 'vip' OR unlocks_vip = TRUE) INTO v_has_codes;
    
    SELECT EXISTS(
        SELECT 1 FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.deleted_at IS NULL AND p.in_stock = TRUE AND c.is_vip = TRUE
    ) INTO v_has_products;
    
    RETURN v_has_codes AND v_has_products;
END;
$$;


-- 9.5. Checkout do Cliente (com salvamento de snapshot do estoque)
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


-- 9.6. Checkout do Admin/Presencial (com desconto seguro e snapshot de estoque)
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


-- 9.7. Atualizar Status do Pedido (Gerenciando estorno/recálculo de estoque baseado no snapshot, tracking do cancelamento e datas de ação)
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
            
            IF FOUND AND COALESCE((v_item->>'tracked_stock')::boolean, v_product.track_stock) THEN
                UPDATE public.products 
                SET stock = stock - v_qty 
                WHERE id = (v_item->>'id')::uuid;
            END IF;
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


-- ==============================================================================
-- 10. CONFIGURAÇÕES INICIAIS (SEED)
-- ==============================================================================

INSERT INTO public.app_settings (key, value) VALUES ('whatsapp_number', '5545999999999') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('vip_mode', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value, updated_at) VALUES ('catalog_description', '', now()), ('catalog_address', '', now()) ON CONFLICT (key) DO NOTHING;


-- Notifica a API sobre o novo Schema
NOTIFY pgrst, 'reload schema';