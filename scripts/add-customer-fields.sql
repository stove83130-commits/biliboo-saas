-- 🆕 AJOUT DES COLONNES POUR LES INFORMATIONS CLIENT ET LOGO
-- Ces colonnes vont stocker les informations du client qui reçoit la facture
-- et les données du logo du fournisseur extraites du PDF

-- Ajouter les colonnes client à la table invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS customer_city TEXT,
ADD COLUMN IF NOT EXISTS customer_country TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_vat_number TEXT;

-- Ajouter les colonnes logo fournisseur (pour affichage dans le tableau)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS vendor_logo_description TEXT,
ADD COLUMN IF NOT EXISTS vendor_logo_colors TEXT[], -- Array de codes couleur hex
ADD COLUMN IF NOT EXISTS vendor_logo_text TEXT;

-- Vérifier que les colonnes ont été ajoutées
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND (column_name LIKE 'customer_%' OR column_name LIKE 'vendor_logo_%')
ORDER BY ordinal_position;

