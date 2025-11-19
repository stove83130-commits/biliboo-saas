-- Script pour modifier la contrainte valid_email pour accepter les emails Microsoft avec #EXT#
-- Les emails Microsoft peuvent avoir le format: user_gmail.com#EXT#@domain.onmicrosoft.com

-- Supprimer l'ancienne contrainte
ALTER TABLE email_accounts 
DROP CONSTRAINT IF EXISTS valid_email;

-- Ajouter une nouvelle contrainte plus permissive qui accepte:
-- - Les emails standards: user@domain.com
-- - Les emails Microsoft avec #EXT#: user_gmail.com#EXT#@domain.onmicrosoft.com
-- - Les emails avec underscores, tirets, points, etc.
ALTER TABLE email_accounts 
ADD CONSTRAINT valid_email CHECK (
  email ~* '^[A-Za-z0-9._%+#-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  OR email ~* '^[A-Za-z0-9._%+-]+#EXT#@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Vérifier que la contrainte a été modifiée
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'email_accounts' 
  AND constraint_name = 'valid_email';

