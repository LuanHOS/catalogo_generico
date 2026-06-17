-- Cria a tabela de senhas de acesso exclusivas
CREATE TABLE IF NOT EXISTS public.access_codes (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    created_at timestamptz default now()
);

-- Ativa a segurança RLS na tabela
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- Garante a política para os administradores gerenciarem as senhas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'access_codes' AND policyname = 'Admins can manage access codes'
    ) THEN
        CREATE POLICY "Admins can manage access codes"
            ON public.access_codes FOR ALL
            USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

-- ATUALIZAÇÃO CRÍTICA DE SEGURANÇA: Tranca a tabela de produtos
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Admins can manage products'
    ) THEN
        CREATE POLICY "Admins can manage products"
            ON public.products FOR ALL
            USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

-- A função segura (RPC) que o site vai usar para buscar os produtos.
CREATE OR REPLACE FUNCTION public.get_catalog_secure(p_code text DEFAULT '')
RETURNS TABLE (
  id uuid, category_id uuid, name text, description text, image_url text,
  price numeric, sale_price numeric, in_stock boolean, stock integer,
  max_per_cart integer, sort_order integer, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_private_mode boolean;
    v_code_valid boolean;
    v_is_admin boolean;
BEGIN
    -- Verifica se quem está chamando já tem sessão de admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    -- Busca o status do interruptor do modo privado
    SELECT value = 'true' INTO v_private_mode
    FROM public.app_settings
    WHERE key = 'private_mode';

    v_private_mode := COALESCE(v_private_mode, false);

    -- Lógica de bloqueio
    IF v_private_mode AND NOT v_is_admin THEN
        IF p_code = '' THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;

        -- Verifica se a senha digitada existe na lista de ativas
        SELECT EXISTS (
            SELECT 1 FROM public.access_codes 
            WHERE code = p_code
        ) INTO v_code_valid;
        
        IF NOT v_code_valid THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;
    END IF;

    -- Se modo privado estiver desligado, ou a senha for válida, ou for o admin, libera os produtos
    RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.image_url,
           p.price, p.sale_price, p.in_stock, p.stock,
           p.max_per_cart, p.sort_order, p.created_at, p.updated_at
    FROM public.products p
    ORDER BY p.sort_order;
END;
$$;

-- Força o Supabase a atualizar o cache do Schema para não dar o erro que você viu
NOTIFY pgrst, 'reload schema';