-- Migration SQL pour le système d'extraction Receiptor.ai
-- Optimisé pour les performances et la scalabilité

-- Table des comptes email (connexions OAuth)
CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('gmail', 'outlook', 'yahoo')),
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    UNIQUE(user_id, email),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Table des jobs d'extraction
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    progress JSONB DEFAULT '{"emailsAnalyzed": 0, "invoicesFound": 0, "errors": 0}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Contraintes
    CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Table des factures (optimisée pour Receiptor.ai)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    email_id VARCHAR(255) NOT NULL,
    
    -- Données de base
    vendor VARCHAR(255),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    date TIMESTAMP WITH TIME ZONE,
    invoice_number VARCHAR(100),
    category VARCHAR(50) DEFAULT 'other',
    description TEXT,
    payment_method VARCHAR(100),
    source VARCHAR(20) DEFAULT 'gmail',
    
    -- Informations fournisseur
    vendor_address TEXT,
    vendor_city VARCHAR(100),
    vendor_country VARCHAR(100),
    vendor_phone VARCHAR(50),
    vendor_email VARCHAR(255),
    vendor_website VARCHAR(255),
    
    -- Informations de paiement
    payment_status VARCHAR(50) DEFAULT 'paid',
    payment_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Contenu détaillé
    items JSONB,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Fichier original (base64 data URL)
    original_file_url TEXT,
    original_file_name VARCHAR(255),
    original_mime_type VARCHAR(100),
    
    -- Données extraites brutes
    extracted_data JSONB,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    
    -- Métadonnées système
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    UNIQUE(connection_id, email_id),
    CONSTRAINT valid_amount CHECK (amount >= 0),
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_currency CHECK (currency ~* '^[A-Z]{3}$')
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_email_accounts_active ON email_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_user_id ON extraction_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_created_at ON extraction_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_connection_id ON invoices(connection_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor);
CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category);
CREATE INDEX IF NOT EXISTS idx_invoices_amount ON invoices(amount);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_confidence ON invoices(confidence_score);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_category ON invoices(user_id, category);
CREATE INDEX IF NOT EXISTS idx_invoices_user_vendor ON invoices(user_id, vendor);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_email_accounts_updated_at 
    BEFORE UPDATE ON email_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vue pour les statistiques des factures
CREATE OR REPLACE VIEW invoice_stats AS
SELECT 
    user_id,
    COUNT(*) as total_invoices,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    COUNT(DISTINCT vendor) as unique_vendors,
    COUNT(DISTINCT category) as unique_categories,
    AVG(confidence_score) as avg_confidence,
    MIN(date) as earliest_invoice,
    MAX(date) as latest_invoice
FROM invoices
GROUP BY user_id;

-- Vue pour les statistiques par mois
CREATE OR REPLACE VIEW monthly_invoice_stats AS
SELECT 
    user_id,
    DATE_TRUNC('month', date) as month,
    COUNT(*) as invoice_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    COUNT(DISTINCT vendor) as unique_vendors
FROM invoices
WHERE date IS NOT NULL
GROUP BY user_id, DATE_TRUNC('month', date)
ORDER BY month DESC;

-- Politiques RLS (Row Level Security)
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Politique pour email_accounts
CREATE POLICY "Users can only access their own email accounts" ON email_accounts
    FOR ALL USING (auth.uid() = user_id);

-- Politique pour extraction_jobs
CREATE POLICY "Users can only access their own extraction jobs" ON extraction_jobs
    FOR ALL USING (auth.uid() = user_id);

-- Politique pour invoices
CREATE POLICY "Users can only access their own invoices" ON invoices
    FOR ALL USING (auth.uid() = user_id);

-- Fonction pour nettoyer les données anciennes (maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Supprime les jobs d'extraction de plus de 30 jours
    DELETE FROM extraction_jobs 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND status IN ('completed', 'failed');
    
    -- Supprime les fichiers originaux de plus de 1 an (optionnel)
    -- UPDATE invoices 
    -- SET original_file_url = NULL, original_file_name = NULL, original_mime_type = NULL
    -- WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour la documentation
COMMENT ON TABLE email_accounts IS 'Comptes email connectés via OAuth pour l''extraction automatique';
COMMENT ON TABLE extraction_jobs IS 'Jobs d''extraction de factures avec suivi du progrès';
COMMENT ON TABLE invoices IS 'Factures extraites avec données structurées et fichiers originaux';

COMMENT ON COLUMN invoices.original_file_url IS 'URL data:base64 du fichier original (PDF, image, HTML)';
COMMENT ON COLUMN invoices.extracted_data IS 'Données brutes extraites par l''IA';
COMMENT ON COLUMN invoices.confidence_score IS 'Score de confiance de l''extraction (0-1)';
COMMENT ON COLUMN invoices.items IS 'Articles détaillés de la facture en JSON';
COMMENT ON COLUMN invoices.tags IS 'Tags personnalisés pour l''organisation';

-- Données de test (optionnel - à supprimer en production)
-- INSERT INTO email_accounts (user_id, provider, email, access_token, refresh_token) 
-- VALUES ('test-user-id', 'gmail', 'test@example.com', 'test-token', 'test-refresh');

COMMIT;

