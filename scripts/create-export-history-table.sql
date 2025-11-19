-- Créer la table pour l'historique des exports
CREATE TABLE IF NOT EXISTS export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Détails de l'export
  format TEXT NOT NULL CHECK (format IN ('pdf', 'excel', 'csv', 'zip')),
  invoice_count INTEGER NOT NULL,
  total_amount DECIMAL(10, 2),
  
  -- Destination
  destination TEXT NOT NULL CHECK (destination IN ('download', 'email', 'cloud')),
  destination_email TEXT,
  
  -- Fichier généré
  file_url TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER, -- en bytes
  
  -- Options utilisées
  options JSONB,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON export_history(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs ne peuvent voir que leurs propres exports
CREATE POLICY "Users can view their own exports"
  ON export_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent créer leurs propres exports
CREATE POLICY "Users can create their own exports"
  ON export_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent supprimer leurs propres exports
CREATE POLICY "Users can delete their own exports"
  ON export_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Commentaires
COMMENT ON TABLE export_history IS 'Historique des exports de factures';
COMMENT ON COLUMN export_history.format IS 'Format d''export: pdf, excel, csv ou zip';
COMMENT ON COLUMN export_history.destination IS 'Destination: download, email ou cloud';
COMMENT ON COLUMN export_history.expires_at IS 'Date d''expiration du fichier (30 jours par défaut)';

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Table export_history créée avec succès';
END $$;

