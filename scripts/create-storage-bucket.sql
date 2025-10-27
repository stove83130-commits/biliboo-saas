-- ============================================
-- CRÉATION DU BUCKET SUPABASE STORAGE
-- ============================================
-- Ce script crée le bucket pour stocker les factures

-- 1. Créer le bucket "invoices" (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Créer les policies pour le bucket
-- Policy pour permettre aux utilisateurs de lire leurs propres factures
CREATE POLICY "Users can read their own invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy pour permettre aux utilisateurs d'uploader leurs propres factures
CREATE POLICY "Users can upload their own invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy pour permettre aux utilisateurs de supprimer leurs propres factures
CREATE POLICY "Users can delete their own invoices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Vérifier la création
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id = 'invoices';



