# Guide : Vérification et Correction Stripe Production

## 🔍 Problème identifié

Si vous avez changé les clés Stripe de **test** vers **production**, vous devez **absolument** vous assurer que :

1. ✅ Les **clés API** sont de production (`sk_live_` et `pk_live_`)
2. ✅ Les **Price ID** sont de production (ils doivent exister dans votre compte Stripe en mode Production)
3. ✅ Le **webhook secret** est de production (`whsec_` de production)

**❌ INCOMPATIBILITÉ :** Vous ne pouvez PAS utiliser :
- Une clé de production (`sk_live_`) avec des Price ID de test
- Une clé de test (`sk_test_`) avec des Price ID de production

## 🔧 Vérification étape par étape

### Étape 1 : Vérifier vos clés Stripe

#### Dans Vercel Dashboard
1. Allez dans **Settings** > **Environment Variables**
2. Vérifiez que `STRIPE_SECRET_KEY` commence par `sk_live_` (pas `sk_test_`)
3. Vérifiez que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` commence par `pk_live_` (pas `pk_test_`)

#### Dans votre fichier `.env.local` (local)
Ouvrez `.env.local` et vérifiez aussi que les clés commencent par `sk_live_` et `pk_live_`.

### Étape 2 : Vérifier vos Price ID

**⚠️ C'EST PROBABLEMENT LÀ LE PROBLÈME !**

#### Dans Stripe Dashboard - MODE PRODUCTION

1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **IMPORTANT : Basculez en mode PRODUCTION** (bouton en haut à droite)
3. Allez dans **Products**
4. Pour chaque produit (Starter, Pro, Business) :
   - Cliquez sur le produit
   - Vérifiez que vous avez bien créé les **prices** en mode **PRODUCTION**
   - Si vous ne voyez que des prices en mode TEST, vous devez les créer en production !
   - Copiez les **Price ID** (ils commencent par `price_`)

#### Créer les Prices en Production si nécessaire

Si vous n'avez pas de prices en production :

1. Dans Stripe Dashboard (mode Production) :
   - Allez dans **Products**
   - Sélectionnez ou créez vos produits (Starter, Pro, Business)
   - Pour chaque produit :
     - Créez un **Price** mensuel avec le montant correct
     - Créez un **Price** annuel avec le montant correct
     - Copiez les Price ID (commencent par `price_`)

#### Dans Vercel Dashboard

1. Allez dans **Settings** > **Environment Variables**
2. Vérifiez que tous ces Price ID correspondent aux Price ID de **PRODUCTION** :
   - `STRIPE_STARTER_MONTHLY_PRICE_ID` = Price ID de production (pas de test)
   - `STRIPE_STARTER_ANNUAL_PRICE_ID` = Price ID de production (pas de test)
   - `STRIPE_PRO_MONTHLY_PRICE_ID` = Price ID de production (pas de test)
   - `STRIPE_PRO_ANNUAL_PRICE_ID` = Price ID de production (pas de test)
   - `STRIPE_BUSINESS_MONTHLY_PRICE_ID` = Price ID de production (pas de test)
   - `STRIPE_BUSINESS_ANNUAL_PRICE_ID` = Price ID de production (pas de test)

### Étape 3 : Comment identifier un Price ID de test vs production

**❌ Price ID de TEST :** 
- Peut contenir `test` dans l'ID
- Souvent plus courts
- Exemple : `price_1234567890test`

**✅ Price ID de PRODUCTION :**
- Ne contient jamais `test`
- Format standard : `price_xxxxxxxxxxxxx`
- Doit exister dans votre compte Stripe en mode **Production**

### Étape 4 : Tester la cohérence

Pour vérifier si vos Price ID correspondent à votre clé :

1. Dans Stripe Dashboard (mode Production) :
   - Utilisez l'API Explorer ou un outil de test
   - Essayez de récupérer un Price avec votre clé de production
   - Si vous obtenez une erreur "No such price", c'est que le Price ID n'existe pas dans ce compte/mode

## 🔄 Solution : Mettre à jour les Price ID dans Vercel

### Si vous avez déjà les Price ID de production

1. Dans **Vercel Dashboard** > **Settings** > **Environment Variables**
2. Pour chaque variable Price ID :
   - Cliquez sur la variable
   - Remplacez la valeur par le Price ID de **PRODUCTION**
   - Assurez-vous de sélectionner les environnements : Production, Preview, Development
   - Sauvegardez

### Si vous devez créer les Price ID en production

1. Dans Stripe Dashboard (mode Production) :
   - Allez dans **Products**
   - Pour chaque produit :
     - Créez un nouveau **Price** (bouton "Add price")
     - Type : Recurring
     - Billing period : Monthly ou Yearly
     - Amount : montant en centimes (ex: 2900 = 29€)
     - Copiez le Price ID généré

2. Dans Vercel :
   - Ajoutez/mettez à jour les variables avec les nouveaux Price ID

## ✅ Vérification finale

Après avoir mis à jour les Price ID :

1. Redéployez sur Vercel
2. Testez un paiement
3. Vérifiez les logs Vercel si une erreur persiste

## 🆘 Erreurs courantes

### Erreur : "No such price: price_xxxxx"
**Cause :** Le Price ID n'existe pas dans le compte Stripe de production
**Solution :** Créez le price en mode Production dans Stripe Dashboard

### Erreur : "Invalid price: price_xxxxx"  
**Cause :** Le Price ID existe dans un autre mode (test) que celui de votre clé
**Solution :** Vérifiez que le Price ID est bien de production et que votre clé est bien `sk_live_`

### Erreur : "Price ID manquant"
**Cause :** La variable d'environnement n'est pas configurée dans Vercel
**Solution :** Ajoutez la variable dans Vercel Dashboard

## 📝 Checklist complète

- [ ] `STRIPE_SECRET_KEY` commence par `sk_live_` (Vercel + .env.local)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` commence par `pk_live_` (Vercel + .env.local)
- [ ] Tous les Price ID existent dans Stripe Dashboard en mode **Production**
- [ ] Tous les Price ID dans Vercel correspondent aux Price ID de production
- [ ] `STRIPE_WEBHOOK_SECRET` est celui de production (commence par `whsec_`)
- [ ] Redéploiement effectué sur Vercel après modifications

## 🎯 Test rapide

Pour vérifier rapidement si tout est cohérent :

1. Ouvrez la console du navigateur (F12)
2. Essayez de créer une session de paiement
3. Regardez le message d'erreur détaillé (maintenant il indique exactement ce qui manque)
4. Si vous voyez "Price ID manquant", vérifiez que la variable est bien dans Vercel
5. Si vous voyez une erreur Stripe, c'est probablement une incohérence entre clé et Price ID
