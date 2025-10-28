-- SQL Hook pour définir onboarding_completed à false pour tous les nouveaux utilisateurs
-- À exécuter dans Supabase Dashboard → Authentication → Hooks

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"onboarding_completed": false}'::jsonb
WHERE NOT raw_user_meta_data ? 'onboarding_completed';

