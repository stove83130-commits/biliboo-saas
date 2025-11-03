# Guide : Vérifier Quelle Clé Stripe Est Utilisée

## 🔍 Problème Identifié

L'URL Stripe Checkout contient `cs_test_` au lieu de `cs_live_`, ce qui signifie qu'une clé de **test** est utilisée au lieu d'une clé de **production**.

## ✅ Solution Immédiate

### Étape 1 : Vérifier les Logs Vercel

1. **Vercel Dashboard** → Votre projet → **Functions** → **Logs**
2. Lancez une tentative de paiement depuis `bilibou.com`
3. Cherchez les logs avec `🔑 Configuration Stripe:`
4. **Vérifiez** :
   - `isProduction: true` ou `false`
   - `keyPrefix: "sk_live_..."` ou `"sk_test_..."`

### Étape 2 : Vérifier les Variables dans Vercel

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Cherchez `STRIPE_SECRET_KEY`
3. **Vérifiez** :
   - Combien d'entrées `STRIPE_SECRET_KEY` vous avez
   - Pour chaque entrée, ouvrez-la et vérifiez :
     - La valeur commence par `sk_live_` (pas `sk_test_`)
     - Les environnements assignés (Production, Preview, Development)
   - **TOUTES les entrées doivent être en `sk_live_...`**

### Étape 3 : Problème Fréquent - Variables Multiple

Si vous avez **plusieurs** `STRIPE_SECRET_KEY` :

- Une pour "Production" = `sk_live_...` ✅
- Une pour "Preview" = `sk_test_...` ❌
- Une pour "Development" = `sk_test_...` ❌

**Et que vous testez depuis un domaine qui utilise "Preview"**, Vercel utilisera la clé de test !

**Solution :**
- Soit mettre `sk_live_...` aussi pour Preview et Development
- Soit tester uniquement depuis le domaine de production (pas `.vercel.app`)

### Étape 4 : Forcer un Nouveau Déploiement

1. **Vercel Dashboard** → **Deployments**
2. Cliquez sur les **3 points** du dernier déploiement
3. **Redeploy** (pas juste rebuild)
4. Attendez la fin complète
5. Testez à nouveau

### Étape 5 : Vérifier le Domaine Utilisé

- Si vous testez sur `xxx.vercel.app` → C'est peut-être un **Preview Deployment** qui utilise les variables de "Preview"
- **Testez sur `bilibou.com`** (votre domaine de production)

## 🎯 Action Immédiate

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Ouvrez **chaque** `STRIPE_SECRET_KEY` une par une
3. Vérifiez que **TOUTES** commencent par `sk_live_` (pas `sk_test_`)
4. Si une seule est en `sk_test_`, modifiez-la pour mettre `sk_live_...`
5. Assurez-vous qu'elles sont assignées à **Production, Preview, Development**
6. **Redeploy**
7. Testez à nouveau

## 📋 Checklist

- [ ] Toutes les variables `STRIPE_SECRET_KEY` dans Vercel commencent par `sk_live_`
- [ ] Variables assignées à "Production" (et Preview/Development si nécessaire)
- [ ] Logs Vercel montrent `isProduction: true`
- [ ] Logs Vercel montrent `keyPrefix: "sk_live_..."`
- [ ] Nouveau déploiement effectué
- [ ] Test effectué depuis `bilibou.com` (pas `.vercel.app`)

## 🔍 Diagnostic via les Logs

Les logs que j'ai ajoutés vous diront exactement :

```javascript
🔑 Configuration Stripe: {
  keyPrefix: "sk_live_51...",  // ou "sk_test_51..."
  isProduction: true,           // ou false
  isTest: false,                // ou true
  warning: "✅ Clé de production" // ou "⚠️ ATTENTION: Clé en mode TEST!"
}
```

**Si vous voyez** :
- `isProduction: false` → La clé utilisée est en test
- `keyPrefix: "sk_test_..."` → La clé utilisée est en test

**Même si vous pensez avoir mis à jour**, vérifiez dans Vercel que toutes les variables sont bien en production.

