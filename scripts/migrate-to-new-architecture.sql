-- ============================================
-- MIGRATION VERS LA NOUVELLE ARCHITECTURE
-- ============================================
-- Ce script migre l'ancienne structure vers la nouvelle

-- 1. Créer un client par défaut pour l'utilisateur actuel
INSERT INTO clients (user_id, email, name, active)
SELECT 
  auth.uid(),
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  true
FROM auth.users u
WHERE u.id = auth.uid()
ON CONFLICT (user_id, email) DO NOTHING;

-- 2. Migrer les anciennes connexions email vers email_configurations
INSERT INTO email_configurations (
  client_id,
  email_provider,
  imap_email,
  oauth_access_token,
  oauth_refresh_token,
  is_active,
  last_sync_at,
  created_at
)
SELECT 
  c.id AS client_id,
  ea.provider AS email_provider,
  ea.email AS imap_email,
  ea.access_token AS oauth_access_token,
  ea.refresh_token AS oauth_refresh_token,
  ea.is_active,
  ea.last_synced_at AS last_sync_at,
  ea.created_at
FROM email_accounts ea
JOIN clients c ON c.user_id = ea.user_id
WHERE ea.user_id = auth.uid()
ON CONFLICT (client_id, imap_email) DO NOTHING;

-- 3. Afficher le résultat
SELECT 
  'Clients créés' AS action,
  COUNT(*) AS count
FROM clients
WHERE user_id = auth.uid()
UNION ALL
SELECT 
  'Configurations email créées' AS action,
  COUNT(*) AS count
FROM email_configurations ec
JOIN clients c ON c.id = ec.client_id
WHERE c.user_id = auth.uid();



