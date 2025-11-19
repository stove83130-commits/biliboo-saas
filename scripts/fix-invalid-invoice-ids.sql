-- 🔧 CORRECTION DES IDS INVALIDES
-- Ce script va RÉGÉNÉRER de nouveaux UUIDs pour les factures avec des IDs invalides
-- ⚠️ ATTENTION : Les anciens IDs seront perdus, mais les factures seront conservées !

-- 1. Créer une table temporaire avec les nouvelles données
CREATE TEMP TABLE invoices_to_fix AS
SELECT 
  *,
  gen_random_uuid() as new_id  -- Générer un nouvel UUID
FROM invoices
WHERE NOT (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 2. Afficher ce qui va être corrigé
SELECT 
  id as ancien_id_invalide,
  new_id as nouvel_id_valide,
  vendor,
  date,
  amount
FROM invoices_to_fix;

-- 3. Supprimer les anciennes entrées invalides
DELETE FROM invoices
WHERE NOT (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 4. Réinsérer avec les nouveaux IDs
INSERT INTO invoices (
  id, user_id, connection_id, email_id, vendor, amount, currency, date,
  invoice_number, category, description, payment_method, source,
  vendor_address, vendor_city, vendor_country, vendor_phone, vendor_email,
  vendor_website, payment_status, payment_date, due_date, subtotal,
  tax_amount, tax_rate, extracted_data, items, notes, tags,
  original_file_url, original_file_name, original_mime_type,
  extracted_at, created_at, updated_at
)
SELECT 
  new_id, user_id, connection_id, email_id, vendor, amount, currency, date,
  invoice_number, category, description, payment_method, source,
  vendor_address, vendor_city, vendor_country, vendor_phone, vendor_email,
  vendor_website, payment_status, payment_date, due_date, subtotal,
  tax_amount, tax_rate, extracted_data, items, notes, tags,
  original_file_url, original_file_name, original_mime_type,
  extracted_at, created_at, updated_at
FROM invoices_to_fix;

-- 5. Afficher le résultat
SELECT 
  COUNT(*) as total_factures,
  COUNT(CASE WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 END) as factures_valides,
  COUNT(CASE WHEN NOT (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN 1 END) as factures_invalides
FROM invoices;

-- ✅ Toutes les factures devraient maintenant avoir des IDs valides !



