-- ⚠️ ATTENTION : Ce script va supprimer les factures avec des IDs invalides !
-- Exécutez d'abord check-invalid-invoice-ids.sql pour voir ce qui sera supprimé

-- Supprimer les factures avec des IDs qui ne sont PAS des UUIDs valides
DELETE FROM invoices
WHERE NOT (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Afficher le résultat
SELECT 
  COUNT(*) as total_factures_restantes,
  COUNT(CASE WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 END) as factures_valides
FROM invoices;



