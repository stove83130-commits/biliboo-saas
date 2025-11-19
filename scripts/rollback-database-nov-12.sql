-- ============================================
-- SCRIPT DE ROLLBACK BASE DE DONNÉES
-- Restauration à l'état du 12 Novembre 2024
-- ============================================
-- ⚠️ ATTENTION : Ce script va supprimer des colonnes et données récentes
-- Exécutez uniquement si vous êtes sûr de vouloir annuler les changements récents

BEGIN;

-- ============================================
-- 1. SUPPRIMER LES COLONNES AJOUTÉES RÉCEMMENT
-- ============================================

-- Supprimer la colonne token_expires_at de email_accounts (si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE email_accounts DROP COLUMN token_expires_at;
    RAISE NOTICE 'Colonne token_expires_at supprimée de email_accounts';
  END IF;
END $$;

-- Supprimer la colonne workspace_id de email_accounts (si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'workspace_id'
  ) THEN
    -- Supprimer d'abord la contrainte de clé étrangère
    ALTER TABLE email_accounts DROP CONSTRAINT IF EXISTS fk_email_accounts_workspace_id;
    -- Supprimer l'index
    DROP INDEX IF EXISTS idx_email_accounts_workspace_id;
    -- Supprimer la colonne
    ALTER TABLE email_accounts DROP COLUMN workspace_id;
    RAISE NOTICE 'Colonne workspace_id supprimée de email_accounts';
  END IF;
END $$;

-- Supprimer l'index sur token_expires_at (si il existe)
DROP INDEX IF EXISTS idx_email_accounts_token_expires_at;

-- ============================================
-- 2. SUPPRIMER LES TABLES CRÉÉES RÉCEMMENT (si applicable)
-- ============================================

-- Supprimer la table clients (si elle existe et a été créée récemment)
-- ⚠️ ATTENTION : Cela supprimera toutes les données dans cette table
-- DROP TABLE IF EXISTS clients CASCADE;

-- Supprimer la table email_configurations (si elle existe et a été créée récemment)
-- ⚠️ ATTENTION : Cela supprimera toutes les données dans cette table
-- DROP TABLE IF EXISTS email_configurations CASCADE;

-- Supprimer la table invoices_new (si elle existe et a été créée récemment)
-- ⚠️ ATTENTION : Cela supprimera toutes les données dans cette table
-- DROP TABLE IF EXISTS invoices_new CASCADE;

-- Supprimer la table invoice_items (si elle existe et a été créée récemment)
-- ⚠️ ATTENTION : Cela supprimera toutes les données dans cette table
-- DROP TABLE IF EXISTS invoice_items CASCADE;

-- Supprimer la table extraction_jobs_new (si elle existe et a été créée récemment)
-- ⚠️ ATTENTION : Cela supprimera toutes les données dans cette table
-- DROP TABLE IF EXISTS extraction_jobs_new CASCADE;

-- ============================================
-- 3. SUPPRIMER LES FONCTIONS CRÉÉES RÉCEMMENT (si applicable)
-- ============================================

-- Supprimer les fonctions personnalisées créées récemment si nécessaire
-- DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;

-- ============================================
-- 4. VÉRIFICATION
-- ============================================

-- Afficher la structure actuelle de email_accounts
DO $$
DECLARE
  columns_info TEXT;
BEGIN
  SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
  INTO columns_info
  FROM information_schema.columns
  WHERE table_name = 'email_accounts';
  
  RAISE NOTICE 'Structure actuelle de email_accounts: %', columns_info;
END $$;

COMMIT;

-- ============================================
-- NOTES
-- ============================================
-- Ce script annule uniquement les changements de structure (colonnes, tables)
-- Il ne restaure PAS les données supprimées ou modifiées
-- Pour une restauration complète des données, utilisez Point-in-Time Recovery (PITR)
-- dans le dashboard Supabase

