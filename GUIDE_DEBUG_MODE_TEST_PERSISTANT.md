# Guide : Debug Mode Test Persistant

## 🔍 Diagnostic Immédiat

Si vous voyez toujours "Environnement de test" malgré toutes les configurations en production, suivez ces étapes dans l'ordre.

## ✅ Étape 1 : Vérifier les Logs Vercel (CRITIQUE)

Les logs que j'ai ajoutés vous diront EXACTEMENT quelle clé est utilisée.

### Comment faire :

1. **Vercel Dashboard** → Votre projet → **Functions** → **Logs**
2. **Ouvrez un onglet avec votre site en production** (dans un autre navigateur)
3. **Tentez de prendre un abonnement**
4. **Immédiatement retournez dans les logs Vercel**
5. **Filtrez par :** `/api/billing/checkout`
6. **Cherchez les logs récents** (les 2-3 dernières lignes)

### Ce que vous devez voir :

```
🔑 Configuration Stripe: {
  keyPrefix: "sk_live_51...",
  isProduction: true/false,
  isTest: true/false,
  environment: "production" ou autre
}
```

**Si vous voyez :**
- `isProduction: false` et `isTest: true` → La clé utilisée est bien en test, même si vous pensez avoir mis à jour
- `isProduction: true` mais toujours "Environnement de test" → C'est un autre problème (voir étape 2)

## ✅ Étape 2 : Vérifier les Variables d'Environnement dans Vercel

### Cas 1 : Plusieurs variables STRIPE_SECRET_KEY

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. **Cherchez** `STRIPE_SECRET_KEY`
3. **Comptez** combien d'entrées vous avez :
   - Si vous en avez plusieurs (une pour Production, une pour Preview, une pour Development)
   - **Vérifiez CHAQUE entrée individuellement**
   - Ouvrez chaque entrée et vérifiez la valeur
   - **Toutes doivent commencer par `sk_live_`**

### Cas 2 : Variable pour Preview/Development en test

Si vous avez :
- `STRIPE_SECRET_KEY` pour "Production" = `sk_live_...` ✅
- `STRIPE_SECRET_KEY` pour "Preview" = `sk_test_...` ❌
- `STRIPE_SECRET_KEY` pour "Development" = `sk_test_...` ❌

**ET que vous testez sur un URL `.vercel.app`**, Vercel peut utiliser les variables de "Preview" au lieu de "Production" !

**Solution :**
- Soit mettre `sk_live_...` aussi pour Preview et Development
- Soit tester sur votre domaine de production (pas `.vercel.app`)

## ✅ Étape 3 : Vérifier sur Quel Domaine Vous Testez

- ❌ Si vous testez sur `xxx.vercel.app` → C'est peut-être un **Preview Deployment** qui utilise les variables de "Preview"
- ✅ Testez sur votre **domaine de production** (ex: `votre-site.com`)

## ✅ Étape 4 : Forcer un Nouveau Déploiement

1. **Vercel Dashboard** → **Deployments**
2. Cliquez sur les **3 points** du dernier déploiement
3. **Redeploy** (pas juste rebuild)
4. Attendez la fin complète
5. **Videz le cache du navigateur** (Ctrl+Shift+Del ou navigation privée)
6. Testez à nouveau

## ✅ Étape 5 : Vérifier les Logs lors de la Création de Session

Dans les logs Vercel, cherchez aussi :

```
🎯 Création session checkout: {
  ...
  stripeMode: "PRODUCTION (sk_live_)" ou "TEST (sk_test_)"
}
```

Si `stripeMode` dit "TEST" alors que vos variables sont en production, c'est que la mauvaise variable est utilisée.

## 🔧 Solutions Possibles

### Solution 1 : Uniformiser Toutes les Variables

Dans Vercel → Environment Variables :
- Pour **Production** : `STRIPE_SECRET_KEY` = `sk_live_...`
- Pour **Preview** : `STRIPE_SECRET_KEY` = `sk_live_...` (même valeur)
- Pour **Development** : `STRIPE_SECRET_KEY` = `sk_live_...` (même valeur)

Puis redéployez.

### Solution 2 : Vérifier le Cache des Variables

Parfois Vercel met du temps à recharger les variables.

**Solution :**
1. Modifiez légèrement `STRIPE_SECRET_KEY` (ajoutez un espace à la fin, puis enlevez-le)
2. Sauvegardez
3. Redéployez

### Solution 3 : Vérifier qu'il n'y a pas de Variables Cachées

1. Dans Vercel → Environment Variables
2. Utilisez la recherche pour `STRIPE`
3. Vérifiez qu'il n'y a pas de variables avec des noms proches comme :
   - `STRIPE_SECRET_KEY_OLD`
   - `STRIPE_SECRET_KEY_TEST`
   - etc.

## 🎯 Action Immédiate

**FAITES CECI MAINTENANT :**

1. Ouvrez **Vercel Dashboard** → **Functions** → **Logs**
2. Ouvrez votre site dans un autre onglet
3. Tentez un paiement
4. Regardez immédiatement les logs
5. **COLPORTEZ-MOI** ce que vous voyez dans les logs `🔑 Configuration Stripe:`

Cela me dira exactement quelle clé est utilisée et pourquoi vous voyez "Environnement de test".

