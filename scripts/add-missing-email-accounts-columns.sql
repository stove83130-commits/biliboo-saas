-- ============================================
-- SCRIPT POUR AJOUTER LES COLONNES MANQUANTES
-- À LA TABLE email_accounts
-- ============================================
-- Exécutez ce script dans Supabase SQL Editor
-- Cela résoudra l'erreur lors de la connexion Microsoft/Outlook

BEGIN;

-- 1. Ajouter token_expires_at (date d'expiration du token OAuth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE email_accounts 
    ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Colonne token_expires_at ajoutée à email_accounts';
  ELSE
    RAISE NOTICE 'Colonne token_expires_at existe déjà';
  END IF;
END $$;

-- 2. Ajouter workspace_id (ID de l'espace de travail)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'workspace_id'
  ) THEN
    -- Ajouter la colonne sans contrainte d'abord
    ALTER TABLE email_accounts 
    ADD COLUMN workspace_id UUID;
    
    -- Ajouter la contrainte de clé étrangère seulement si la table workspaces existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
      ALTER TABLE email_accounts 
      ADD CONSTRAINT fk_email_accounts_workspace_id 
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
      RAISE NOTICE 'Contrainte de clé étrangère ajoutée pour workspace_id';
    ELSE
      RAISE NOTICE 'Table workspaces non trouvée, contrainte de clé étrangère non ajoutée';
    END IF;
    
    RAISE NOTICE 'Colonne workspace_id ajoutée à email_accounts';
  ELSE
    RAISE NOTICE 'Colonne workspace_id existe déjà';
  END IF;
END $$;

-- 3. Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace_id ON email_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_token_expires_at ON email_accounts(token_expires_at);

-- 4. Vérifier que les colonnes ont été ajoutées
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'email_accounts' 
  AND column_name IN ('token_expires_at', 'workspace_id')
ORDER BY column_name;

COMMIT;

-- ✅ Si vous voyez 2 lignes dans le résultat (token_expires_at et workspace_id), c'est bon !
-- Vous pouvez maintenant réessayer de connecter votre compte Microsoft/Outlook

