-- Ajouter la colonne account_email à la table invoices
-- Cette colonne stocke l'email du compte Gmail/Outlook utilisé pour extraire la facture

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS account_email TEXT;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN invoices.account_email IS 'Email du compte Gmail/Outlook utilisé pour extraire cette facture';

-- Créer un index pour améliorer les performances de recherche par compte
CREATE INDEX IF NOT EXISTS idx_invoices_account_email ON invoices(account_email);

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Colonne account_email ajoutée avec succès à la table invoices';
END $$;

