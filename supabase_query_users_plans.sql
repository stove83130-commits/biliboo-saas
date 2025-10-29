-- Requête pour voir tous les utilisateurs avec leurs plans
-- Les plans sont stockés dans raw_user_meta_data
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  -- Les données du plan sont dans raw_user_meta_data
  raw_user_meta_data->>'selected_plan' as plan,
  raw_user_meta_data->>'subscription_status' as statut,
  raw_user_meta_data->>'stripe_subscription_id' as stripe_id,
  raw_user_meta_data->>'current_period_end' as fin_periode,
  raw_user_meta_data->>'is_trial' as essai,
  raw_user_meta_data->>'trial_ends_at' as fin_essai,
  raw_user_meta_data->>'stripe_customer_id' as customer_stripe,
  -- Voir l'usage
  raw_user_meta_data->'usage'->'invoicesByPeriod' as factures_par_periode
FROM auth.users
ORDER BY created_at DESC;

