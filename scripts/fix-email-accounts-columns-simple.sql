-- Script SIMPLE pour ajouter les colonnes manquantes à email_accounts
-- Exécutez ce script dans Supabase SQL Editor

-- 1. Ajouter token_expires_at (sans problème)
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Ajouter workspace_id SANS contrainte de clé étrangère d'abord
-- (pour éviter les erreurs si la table workspaces n'existe pas)
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- 3. Vérifier que les colonnes ont été ajoutées
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'email_accounts' 
  AND column_name IN ('token_expires_at', 'workspace_id')
ORDER BY column_name;

-- Si vous voyez les 2 colonnes dans le résultat, c'est bon !
-- Si vous voulez ajouter la contrainte de clé étrangère après (optionnel) :
-- ALTER TABLE email_accounts 
-- ADD CONSTRAINT fk_email_accounts_workspace_id 
-- FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

