
-- 1. Restrict products SELECT to admins only on base table; expose a public view without `cost`.
DROP POLICY IF EXISTS "Products are public" ON public.products;

CREATE POLICY "Admins can read products"
ON public.products FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = false) AS
SELECT id, name, description, price, in_stock, max_per_cart,
       sort_order, category_id, image_url, created_at, updated_at
FROM public.products;

GRANT SELECT ON public.products_public TO anon, authenticated;

-- 2. Lock down user_roles writes to admins only.
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
