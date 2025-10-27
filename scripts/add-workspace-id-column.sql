-- 🏢 AJOUT DE LA COLONNE workspace_id POUR SÉPARER LES ESPACES DE TRAVAIL
-- Cette colonne permet de filtrer les factures par espace de travail (personnel vs organisation)

-- Ajouter la colonne workspace_id à la table invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN invoices.workspace_id IS 'ID de l''espace de travail (workspace) auquel appartient cette facture. NULL = espace personnel par défaut.';

-- Créer un index pour améliorer les performances de recherche par workspace
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_id ON invoices(workspace_id);

-- Mettre à jour les factures existantes pour les associer à l'espace personnel
-- (Optionnel : si vous voulez que les factures existantes restent dans l'espace personnel)
-- UPDATE invoices 
-- SET workspace_id = (
--   SELECT id FROM workspaces 
--   WHERE owner_id = invoices.user_id 
--   AND type = 'personal' 
--   LIMIT 1
-- )
-- WHERE workspace_id IS NULL;

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Colonne workspace_id ajoutée avec succès à la table invoices';
END $$;

-- Vérifier que la colonne a été ajoutée
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name = 'workspace_id';

