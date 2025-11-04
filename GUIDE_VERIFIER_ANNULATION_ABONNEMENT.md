# Guide : Vérifier l'annulation d'un abonnement

Ce guide explique comment vérifier qu'un abonnement a été correctement annulé dans le backend.

## Méthode 1 : Vérifier dans Supabase (user_metadata)

### Via l'interface Supabase
1. Allez sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Authentication** > **Users**
4. Recherchez l'utilisateur concerné
5. Ouvrez les détails de l'utilisateur
6. Consultez la section **User Metadata** (métadonnées utilisateur)

### Métadonnées à vérifier après annulation :
```json
{
  "subscription_status": "cancelled",
  "cancellation_date": "2025-01-XX...",
  "subscription_ends_at": "2025-02-XX...",
  "stripe_subscription_id": "sub_xxxxx"
}
```

### Via SQL (Supabase SQL Editor)
```sql
-- Vérifier le statut d'annulation d'un utilisateur spécifique
SELECT 
  id,
  email,
  raw_user_meta_data->>'subscription_status' as subscription_status,
  raw_user_meta_data->>'cancellation_date' as cancellation_date,
  raw_user_meta_data->>'subscription_ends_at' as subscription_ends_at,
  raw_user_meta_data->>'stripe_subscription_id' as stripe_subscription_id,
  raw_user_meta_data->>'stripe_customer_id' as stripe_customer_id
FROM auth.users
WHERE email = 'email@example.com';

-- Voir tous les abonnements annulés
SELECT 
  id,
  email,
  raw_user_meta_data->>'subscription_status' as subscription_status,
  raw_user_meta_data->>'cancellation_date' as cancellation_date,
  raw_user_meta_data->>'subscription_ends_at' as subscription_ends_at
FROM auth.users
WHERE raw_user_meta_data->>'subscription_status' = 'cancelled';
```

## Méthode 2 : Vérifier dans Stripe Dashboard

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com)
2. Sélectionnez l'environnement (Test ou Production)
3. Allez dans **Customers**
4. Recherchez le customer par email ou ID (`cus_xxxxx`)
5. Ouvrez les détails du customer
6. Allez dans l'onglet **Subscriptions**
7. Vérifiez que l'abonnement a :
   - **Status** : `active` (mais avec "Cancels at period end" indiqué)
   - **Cancel at period end** : `Yes`
   - **Current period end** : Date de fin de période

### Via l'API Stripe (curl)
```bash
# Récupérer l'ID du customer depuis Supabase, puis :
curl https://api.stripe.com/v1/subscriptions?customer=cus_xxxxx \
  -u sk_live_xxxxx: \
  -G

# Vérifier un abonnement spécifique
curl https://api.stripe.com/v1/subscriptions/sub_xxxxx \
  -u sk_live_xxxxx:
```

La réponse devrait contenir :
```json
{
  "cancel_at_period_end": true,
  "status": "active",
  "current_period_end": 1735689600
}
```

## Méthode 3 : Vérifier dans les logs Vercel

1. Allez sur [Vercel Dashboard](https://vercel.com)
2. Sélectionnez votre projet
3. Allez dans **Deployments** > Sélectionnez le dernier déploiement
4. Cliquez sur **Functions** > `/api/billing/cancel-subscription`
5. Consultez les logs récents

### Logs à rechercher :
```
✅ Annulation Stripe réussie
✅ Subscription canceled via webhook
```

### Logs d'erreur possibles :
```
❌ Erreur lors de l'annulation: ...
❌ Erreur lors de la mise à jour des métadonnées: ...
```

## Méthode 4 : Vérifier via l'API de votre application

### Test via l'API de synchronisation
```bash
# Après avoir obtenu le token d'authentification
curl -X POST https://votre-domaine.com/api/billing/sync-plan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

La réponse devrait indiquer :
```json
{
  "success": true,
  "plan": "pro",
  "subscription_status": "cancelled",
  "subscription_id": "sub_xxxxx"
}
```

## Méthode 5 : Vérifier via les webhooks Stripe

1. Allez dans Stripe Dashboard > **Developers** > **Webhooks**
2. Sélectionnez votre webhook endpoint
3. Consultez les événements récents
4. Recherchez les événements suivants :
   - `customer.subscription.updated` (avec `cancel_at_period_end: true`)
   - `customer.subscription.deleted` (quand l'abonnement expire vraiment)

### Vérifier les événements webhook dans votre code
Les webhooks sont gérés dans `app/api/billing/webhook/route.ts`. Vérifiez que les événements sont bien traités.

## Méthode 6 : Créer un script de vérification

Créez un fichier `scripts/verify-subscription-cancellation.ts` :

```typescript
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })

async function verifyCancellation(userEmail: string) {
  console.log(`🔍 Vérification de l'annulation pour: ${userEmail}\n`)

  // 1. Vérifier dans Supabase
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  const user = users?.users.find(u => u.email === userEmail)

  if (!user) {
    console.error('❌ Utilisateur non trouvé')
    return
  }

  console.log('📊 Métadonnées Supabase:')
  console.log({
    subscription_status: user.user_metadata?.subscription_status,
    cancellation_date: user.user_metadata?.cancellation_date,
    subscription_ends_at: user.user_metadata?.subscription_ends_at,
    stripe_customer_id: user.user_metadata?.stripe_customer_id,
    stripe_subscription_id: user.user_meta_data?.stripe_subscription_id
  })

  // 2. Vérifier dans Stripe
  const customerId = user.user_metadata?.stripe_customer_id
  if (customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10
    })

    console.log('\n💳 Abonnements Stripe:')
    subscriptions.data.forEach(sub => {
      console.log({
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
      })
    })
  }

  // 3. Vérifier la cohérence
  const isCancelled = user.user_metadata?.subscription_status === 'cancelled'
  const hasCancellationDate = !!user.user_metadata?.cancellation_date
  const hasEndDate = !!user.user_metadata?.subscription_ends_at

  console.log('\n✅ Résumé:')
  console.log({
    'Statut annulé dans Supabase': isCancelled,
    'Date d\'annulation présente': hasCancellationDate,
    'Date de fin présente': hasEndDate,
    'Cohérence': isCancelled && hasCancellationDate && hasEndDate ? '✅ OK' : '❌ Problème'
  })
}

// Utilisation
const email = process.argv[2]
if (!email) {
  console.error('Usage: ts-node scripts/verify-subscription-cancellation.ts email@example.com')
  process.exit(1)
}

verifyCancellation(email)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erreur:', error)
    process.exit(1)
  })
```

## Checklist de vérification

- [ ] `subscription_status` = `"cancelled"` dans Supabase
- [ ] `cancellation_date` présente dans Supabase
- [ ] `subscription_ends_at` présente dans Supabase
- [ ] `cancel_at_period_end` = `true` dans Stripe
- [ ] `status` = `"active"` dans Stripe (normal, l'abonnement reste actif jusqu'à la fin)
- [ ] Logs Vercel montrent "Annulation Stripe réussie"
- [ ] Webhook `customer.subscription.updated` reçu avec `cancel_at_period_end: true`

## Notes importantes

1. **L'abonnement reste actif** : Quand vous annulez, l'abonnement Stripe reste `active` mais avec `cancel_at_period_end: true`. C'est normal !

2. **Expiration réelle** : L'abonnement ne devient vraiment `canceled` ou `deleted` qu'à la fin de la période de facturation.

3. **Synchronisation** : Les webhooks Stripe mettent à jour automatiquement Supabase. Si ce n'est pas le cas, utilisez `/api/billing/sync-plan` pour forcer la synchronisation.

