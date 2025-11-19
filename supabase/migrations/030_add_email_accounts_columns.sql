-- Migration pour ajouter les colonnes manquantes à email_accounts
-- Ces colonnes sont utilisées par Gmail et Outlook callbacks

-- Ajouter la colonne token_expires_at si elle n'existe pas
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- Ajouter la colonne workspace_id si elle n'existe pas
-- Note: Si la table workspaces n'existe pas, cette commande échouera
-- Dans ce cas, ajoutez d'abord la colonne sans contrainte, puis ajoutez la contrainte après
DO $$
BEGIN
  -- Vérifier si la colonne existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'workspace_id'
  ) THEN
    -- Ajouter la colonne sans contrainte d'abord
    ALTER TABLE email_accounts ADD COLUMN workspace_id UUID;
    
    -- Ajouter la contrainte seulement si la table workspaces existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
      ALTER TABLE email_accounts 
      ADD CONSTRAINT fk_email_accounts_workspace_id 
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN email_accounts.token_expires_at IS 'Date d''expiration du token OAuth';
COMMENT ON COLUMN email_accounts.workspace_id IS 'ID de l''espace de travail (workspace) auquel appartient ce compte email. NULL = espace personnel par défaut.';

-- Créer un index pour améliorer les performances de recherche par workspace
CREATE INDEX IF NOT EXISTS idx_email_accounts_workspace_id ON email_accounts(workspace_id);

-- Créer un index pour améliorer les performances de recherche par expiration de token
CREATE INDEX IF NOT EXISTS idx_email_accounts_token_expires_at ON email_accounts(token_expires_at);

