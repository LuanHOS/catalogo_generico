-- Adiciona a coluna de poder total aos administradores (Todos os atuais viram Master por segurança)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_master boolean NOT NULL DEFAULT true;

-- Força a API a reconhecer a nova coluna
NOTIFY pgrst, 'reload schema';