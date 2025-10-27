-- 🔍 DIAGNOSTIC : Voir toutes les colonnes et leurs valeurs
-- Ce script va afficher les premières factures avec TOUTES leurs colonnes

SELECT 
  id,
  user_id,
  connection_id,
  email_id,
  vendor,
  amount,
  currency,
  date,
  invoice_number,
  category,
  original_file_name,
  original_mime_type,
  created_at
FROM invoices
ORDER BY created_at DESC
LIMIT 5;

-- Vérifier si la colonne 'id' contient des valeurs bizarres
SELECT 
  id,
  CASE 
    WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID VALIDE ✅'
    ELSE 'UUID INVALIDE ❌'
  END as id_status,
  vendor,
  created_at
FROM invoices
ORDER BY created_at DESC;



