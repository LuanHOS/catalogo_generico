-- Cria uma View segura que puxa apenas os produtos não deletados
CREATE OR REPLACE VIEW active_products AS
SELECT * FROM products WHERE deleted_at IS NULL;

-- Cria uma View segura que puxa apenas as categorias não deletadas
CREATE OR REPLACE VIEW active_categories AS
SELECT * FROM categories WHERE deleted_at IS NULL;