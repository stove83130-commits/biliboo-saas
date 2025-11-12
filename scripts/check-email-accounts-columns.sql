-- Script pour vérifier si les colonnes existent dans email_accounts
-- Exécutez ce script dans Supabase SQL Editor pour vérifier

SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'email_accounts' 
  AND column_name IN ('token_expires_at', 'workspace_id')
ORDER BY column_name;

-- Si aucune ligne n'est retournée, les colonnes n'existent pas
-- Si 2 lignes sont retournées, les colonnes existent

