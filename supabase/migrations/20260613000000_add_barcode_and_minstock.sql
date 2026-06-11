-- 1. Adiciona as novas colunas à tabela de produtos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text;

-- 2. Remove a função antiga para permitir a mudança do tipo de retorno
DROP FUNCTION IF EXISTS public.get_catalog_secure(text);

-- 3. Recria a função de segurança incluindo as novas colunas no retorno
CREATE FUNCTION public.get_catalog_secure(p_code text DEFAULT '')
RETURNS TABLE (
  id uuid, category_id uuid, name text, description text, image_url text,
  price numeric, sale_price numeric, in_stock boolean, stock integer,
  min_stock integer, barcode text,
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
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    SELECT value = 'true' INTO v_private_mode
    FROM public.app_settings
    WHERE key = 'private_mode';

    v_private_mode := COALESCE(v_private_mode, false);

    IF v_private_mode AND NOT v_is_admin THEN
        IF p_code = '' THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.access_codes 
            WHERE code = p_code
        ) INTO v_code_valid;
        
        IF NOT v_code_valid THEN
            RAISE EXCEPTION 'ACCESS_DENIED';
        END IF;
    END IF;

    RETURN QUERY
    SELECT p.id, p.category_id, p.name, p.description, p.image_url,
           p.price, p.sale_price, p.in_stock, p.stock,
           p.min_stock, p.barcode,
           p.max_per_cart, p.sort_order, p.created_at, p.updated_at
    FROM public.products p
    ORDER BY p.sort_order;
END;
$$;

-- 4. Força o cache do Supabase a se atualizar
NOTIFY pgrst, 'reload schema';