-- Insere as novas chaves de configuração do rodapé caso não existam
INSERT INTO public.app_settings (key, value, updated_at) VALUES 
('catalog_description', '', now()),
('catalog_address', '', now())
ON CONFLICT (key) DO NOTHING;