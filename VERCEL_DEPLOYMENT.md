# 🚀 Guide de Déploiement Vercel

## ✅ Code déployé

Le code a été poussé vers GitHub : `https://github.com/stove83130-commits/biliboo-saas.git`

## 📋 Variables d'environnement requises sur Vercel

### Variables Supabase (Obligatoires)
```
NEXT_PUBLIC_SUPABASE_URL=https://qkpfxpuhrjgctpadxslh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Variables Stripe (Obligatoires pour la facturation)
```
STRIPE_SECRET_KEY=sk_live_... ou sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... ou pk_test_...
```

### Variables OpenAI (Obligatoires pour l'extraction)
```
OPENAI_API_KEY=sk-...
```

### Variables Email (Obligatoires)
```
RESEND_API_KEY=re_...
EXPORTS_FROM_EMAIL=no-reply@bilibou.com
```

### Variables Google OAuth (Obligatoires pour Gmail)
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Variables Microsoft OAuth (Obligatoires pour Outlook)
```
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=...
```

### Variables OCR (Optionnelles mais recommandées)
```
OCR_SPACE_API_KEY=...
```

### Variables Application (Obligatoires)
```
NEXT_PUBLIC_APP_URL=https://votre-domaine.vercel.app
```

## 🔧 Configuration Vercel

### 1. Connecter le projet GitHub à Vercel

Si le projet n'est pas encore connecté :
1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer sur "Add New Project"
3. Importer le dépôt `biliboo-saas`
4. Vercel détectera automatiquement Next.js

### 2. Configurer les variables d'environnement

Dans le dashboard Vercel :
1. Aller dans **Settings** → **Environment Variables**
2. Ajouter toutes les variables listées ci-dessus
3. Sélectionner les environnements (Production, Preview, Development)

### 3. Configuration du build

Vercel détectera automatiquement :
- **Framework**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 4. Webhooks Stripe

Pour que les webhooks Stripe fonctionnent :
1. Dans Stripe Dashboard → **Developers** → **Webhooks**
2. Ajouter l'endpoint : `https://votre-domaine.vercel.app/api/billing/webhook`
3. Sélectionner les événements :
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
4. Copier le **Signing Secret** et l'ajouter dans Vercel :
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 5. Domaines personnalisés (Optionnel)

Si vous avez un domaine personnalisé :
1. Aller dans **Settings** → **Domains**
2. Ajouter votre domaine
3. Suivre les instructions DNS

## 🔍 Vérification post-déploiement

### 1. Vérifier les variables d'environnement

Visitez : `https://votre-domaine.vercel.app/api/health/env`

Cela affichera quelles variables sont configurées et lesquelles manquent.

### 2. Tester les fonctionnalités principales

- ✅ Connexion/Inscription
- ✅ Connexion Gmail/Outlook
- ✅ Extraction de factures
- ✅ Export PDF/CSV/ZIP
- ✅ Abonnements Stripe
- ✅ Gestion des méthodes de paiement
- ✅ Analytics
- ✅ Historique des exports

### 3. Vérifier les logs

Dans Vercel Dashboard → **Deployments** → Cliquer sur un déploiement → **Logs**

## ⚠️ Points d'attention

1. **Stripe Keys** : Assurez-vous d'utiliser les clés de **production** (`sk_live_` et `pk_live_`) en production
2. **Supabase** : Vérifiez que les URLs et clés correspondent à votre projet Supabase
3. **Google OAuth** : Configurez les **Authorized redirect URIs** dans Google Cloud Console :
   - `https://votre-domaine.vercel.app/api/gmail/callback`
4. **Microsoft OAuth** : Configurez les **Redirect URIs** dans Azure Portal :
   - `https://votre-domaine.vercel.app/api/outlook/callback`
5. **Resend** : Vérifiez que le domaine `bilibou.com` est vérifié dans Resend

## 🚨 En cas de problème

1. **Build échoue** : Vérifier les logs dans Vercel Dashboard
2. **Variables manquantes** : Utiliser `/api/health/env` pour diagnostiquer
3. **Erreurs runtime** : Vérifier les logs de déploiement dans Vercel
4. **Webhooks Stripe** : Vérifier que l'URL est correcte et que le secret est configuré

## 📝 Notes

- Le projet est configuré pour utiliser la région `iad1` (US East)
- Les builds sont optimisés avec `swcMinify`
- TypeScript et ESLint sont configurés pour ne pas bloquer les builds en production

