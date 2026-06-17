CREATE OR REPLACE FUNCTION check_vip_status()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_has_codes BOOLEAN;
    v_has_products BOOLEAN;
BEGIN
    -- Verifica se tem senha VIP
    SELECT EXISTS(SELECT 1 FROM access_codes WHERE code_type = 'vip' OR unlocks_vip = TRUE) INTO v_has_codes;
    
    -- Verifica se tem produto ativo vinculado a uma categoria VIP
    SELECT EXISTS(
        SELECT 1 FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.deleted_at IS NULL AND p.in_stock = TRUE AND c.is_vip = TRUE
    ) INTO v_has_products;
    
    RETURN v_has_codes AND v_has_products;
END;
$$;