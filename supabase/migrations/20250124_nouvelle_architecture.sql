-- ============================================
-- NOUVELLE ARCHITECTURE BASE DE DONNÉES
-- ============================================
-- Basée sur l'architecture fournie par l'utilisateur

-- 1. Table des clients (vos utilisateurs finaux)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- 2. Table des configurations email (credentials cryptées)
CREATE TABLE IF NOT EXISTS email_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email_provider TEXT NOT NULL CHECK (email_provider IN ('gmail', 'outlook', 'imap')),
  
  -- Pour IMAP
  imap_host TEXT,
  imap_port INTEGER,
  imap_email TEXT,
  imap_password TEXT, -- Sera crypté
  
  -- Pour OAuth (Gmail/Outlook)
  oauth_access_token TEXT, -- Sera crypté
  oauth_refresh_token TEXT, -- Sera crypté
  oauth_token_expiry TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, imap_email)
);

-- 3. Table des factures
CREATE TABLE IF NOT EXISTS invoices_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email_config_id UUID NOT NULL REFERENCES email_configurations(id) ON DELETE CASCADE,
  
  -- Métadonnées email
  email_from TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_date TIMESTAMPTZ NOT NULL,
  email_id TEXT, -- ID unique de l'email (pour éviter les doublons)
  
  -- Fichier original
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL, -- URL Supabase Storage
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'png', 'jpg', 'jpeg')),
  file_size BIGINT,
  
  -- Données extraites
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  vendor_name TEXT,
  vendor_address TEXT,
  customer_name TEXT,
  subtotal DECIMAL(10, 2),
  total_tax DECIMAL(10, 2),
  invoice_total DECIMAL(10, 2),
  currency TEXT DEFAULT 'EUR',
  
  -- Statuts
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'success', 'failed')),
  extraction_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, email_id)
);

-- 4. Table des lignes de facturation
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices_new(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  amount DECIMAL(10, 2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table des jobs d'extraction (queue)
CREATE TABLE IF NOT EXISTS extraction_jobs_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email_config_id UUID NOT NULL REFERENCES email_configurations(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Paramètres de recherche
  search_since DATE,
  search_keywords TEXT[],
  
  -- Résultats
  emails_found INTEGER DEFAULT 0,
  invoices_extracted INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX POUR PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_email_configs_client_id ON email_configurations(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices_new(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_email_config_id ON invoices_new(email_config_id);
CREATE INDEX IF NOT EXISTS idx_invoices_extraction_status ON invoices_new(extraction_status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices_new(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_client_id ON extraction_jobs_new(client_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs_new(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs_new ENABLE ROW LEVEL SECURITY;

-- Policies pour clients
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies pour email_configurations
CREATE POLICY "Users can view their own email configs"
  ON email_configurations FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own email configs"
  ON email_configurations FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own email configs"
  ON email_configurations FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own email configs"
  ON email_configurations FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Policies pour invoices_new
CREATE POLICY "Users can view their own invoices"
  ON invoices_new FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own invoices"
  ON invoices_new FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own invoices"
  ON invoices_new FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own invoices"
  ON invoices_new FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Policies pour invoice_items
CREATE POLICY "Users can view their own invoice items"
  ON invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices_new WHERE client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own invoice items"
  ON invoice_items FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices_new WHERE client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  );

-- Policies pour extraction_jobs_new
CREATE POLICY "Users can view their own extraction jobs"
  ON extraction_jobs_new FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own extraction jobs"
  ON extraction_jobs_new FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own extraction jobs"
  ON extraction_jobs_new FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_configurations_updated_at BEFORE UPDATE ON email_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_new_updated_at BEFORE UPDATE ON invoices_new
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extraction_jobs_new_updated_at BEFORE UPDATE ON extraction_jobs_new
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue pour les statistiques des clients
CREATE OR REPLACE VIEW client_statistics AS
SELECT 
  c.id AS client_id,
  c.email,
  c.name,
  COUNT(DISTINCT i.id) AS total_invoices,
  SUM(i.invoice_total) AS total_amount,
  COUNT(DISTINCT CASE WHEN i.extraction_status = 'success' THEN i.id END) AS successful_extractions,
  COUNT(DISTINCT CASE WHEN i.extraction_status = 'failed' THEN i.id END) AS failed_extractions,
  MAX(i.created_at) AS last_invoice_date
FROM clients c
LEFT JOIN invoices_new i ON c.id = i.client_id
GROUP BY c.id, c.email, c.name;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE clients IS 'Table des clients (utilisateurs finaux qui ont des factures)';
COMMENT ON TABLE email_configurations IS 'Configurations email pour chaque client (IMAP ou OAuth)';
COMMENT ON TABLE invoices_new IS 'Table des factures extraites des emails';
COMMENT ON TABLE invoice_items IS 'Lignes de facturation détaillées';
COMMENT ON TABLE extraction_jobs_new IS 'Jobs d''extraction en arrière-plan (queue)';



