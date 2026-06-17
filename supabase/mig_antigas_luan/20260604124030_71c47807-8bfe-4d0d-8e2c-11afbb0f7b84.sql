
DROP VIEW IF EXISTS public.products_public;
DROP POLICY IF EXISTS "Admins can read products" ON public.products;

CREATE POLICY "Products are public"
ON public.products FOR SELECT
TO anon, authenticated
USING (true);

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (id, name, description, price, in_stock, max_per_cart,
              sort_order, category_id, image_url, created_at, updated_at)
ON public.products TO anon;
