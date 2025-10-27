-- Vérifier les factures avec des IDs invalides
-- Un UUID valide doit avoir le format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

SELECT 
  id,
  vendor,
  email_id,
  created_at,
  CASE 
    WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'VALIDE ✅'
    ELSE 'INVALIDE ❌'
  END as id_status
FROM invoices
WHERE NOT (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
ORDER BY created_at DESC
LIMIT 20;

-- Compter le total
SELECT 
  COUNT(*) as total_invoices,
  COUNT(CASE WHEN NOT (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN 1 END) as invalid_ids
FROM invoices;



