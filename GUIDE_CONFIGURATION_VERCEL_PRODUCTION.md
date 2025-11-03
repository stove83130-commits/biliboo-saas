# Guide : Configuration Stripe Production sur Vercel

## ⚠️ IMPORTANT
**Les clés secrètes ne doivent JAMAIS être commitées dans Git.** Elles doivent être configurées uniquement dans les variables d'environnement de Vercel.

## 🔧 Configuration sur Vercel Dashboard

### Étape 1 : Accéder aux Variables d'Environnement
1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet **biliboo-saas**
3. Allez dans **Settings** > **Environment Variables**

### Étape 2 : Ajouter/Mettre à jour les Variables Stripe PRODUCTION

Ajoutez ou mettez à jour les variables suivantes avec vos clés de **PRODUCTION** (pas de test) :

#### Clés Stripe
```
STRIPE_SECRET_KEY
Valeur : sk_live_... (votre clé secrète Stripe de production)
Environnement : Production, Preview, Development
⚠️ Vous avez cette clé dans votre .env.local

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
Valeur : pk_live_... (votre clé publishable Stripe de production)
Environnement : Production, Preview, Development
⚠️ Vous avez cette clé dans votre .env.local
```

#### Webhook Secret
```
STRIPE_WEBHOOK_SECRET
Valeur : [Récupérer depuis Stripe Dashboard > Webhooks > Votre webhook de PRODUCTION]
Environnement : Production uniquement
```

#### Price ID de Production
**Important :** Ces Price ID doivent être ceux de votre compte Stripe en **mode Production**, pas en mode Test.

Pour les obtenir :
1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **Basculez en mode Production** (en haut à droite)
3. Allez dans **Products** > Sélectionnez vos produits
4. Copiez les **Price ID** (ils commencent par `price_`)

```
STRIPE_STARTER_MONTHLY_PRICE_ID
Valeur : price_... (de PRODUCTION)
Environnement : Production, Preview, Development

STRIPE_STARTER_ANNUAL_PRICE_ID
Valeur : price_... (de PRODUCTION)
Environnement : Production, Preview, Development

STRIPE_PRO_MONTHLY_PRICE_ID
Valeur : price_... (de PRODUCTION)
Environnement : Production, Preview, Development

STRIPE_PRO_ANNUAL_PRICE_ID
Valeur : price_... (de PRODUCTION)
Environnement : Production, Preview, Development

STRIPE_BUSINESS_MONTHLY_PRICE_ID
Valeur : price_... (de PRODUCTION)
Environnement : Production, Preview, Development

STRIPE_BUSINESS_ANNUAL_PRICE_ID
Valeur : price_... (de PRODUCTION)
Environnement : Production, Preview, Development
```

### Étape 3 : Configurer le Webhook Stripe en Production

1. Dans **Stripe Dashboard** (mode Production) :
   - Allez dans **Developers** > **Webhooks**
   - Vérifiez que votre webhook pointe vers : `https://votre-domaine.com/api/billing/webhook`
   - Cliquez sur votre webhook
   - Dans l'onglet **Signing secret**, cliquez sur **Reveal**
   - Copiez le secret (commence par `whsec_`)

2. Dans **Vercel Dashboard** :
   - Ajoutez la variable `STRIPE_WEBHOOK_SECRET` avec le secret copié
   - **Important :** Sélectionnez uniquement l'environnement **Production**

### Étape 4 : Redéployer

Après avoir ajouté/mis à jour toutes les variables :

1. Dans **Vercel Dashboard**, allez dans **Deployments**
2. Cliquez sur les **3 points** du dernier déploiement
3. Sélectionnez **Redeploy**
4. Vérifiez que les nouvelles variables d'environnement sont bien chargées

## ✅ Vérification

Après le redéploiement :

1. Testez un paiement sur votre site en production
2. Vous ne devriez **PAS** voir "MODE DE TEST" sur la page de paiement Stripe
3. Le paiement devrait fonctionner avec de l'argent réel

## 🔒 Sécurité

- ✅ Les clés sont stockées uniquement sur Vercel (sécurisé)
- ✅ Le fichier `.env.local` est dans `.gitignore` (ne sera pas commité)
- ✅ Ne partagez jamais ces clés publiquement
- ✅ Ne les commitez JAMAIS dans Git

## 📝 Variables complètes nécessaires sur Vercel

Voici toutes les variables d'environnement Stripe nécessaires pour la production :
⚠️ **Utilisez les valeurs réelles de votre compte Stripe en mode Production**

```
STRIPE_SECRET_KEY=sk_live_[votre_clé_secrète]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_[votre_clé_publishable]
STRIPE_WEBHOOK_SECRET=whsec_[secret_du_webhook_production]
STRIPE_STARTER_MONTHLY_PRICE_ID=price_[id_price_production]
STRIPE_STARTER_ANNUAL_PRICE_ID=price_[id_price_production]
STRIPE_PRO_MONTHLY_PRICE_ID=price_[id_price_production]
STRIPE_PRO_ANNUAL_PRICE_ID=price_[id_price_production]
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_[id_price_production]
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_[id_price_production]
```

**Note :** Les valeurs réelles sont dans votre fichier `.env.local` local, à ne PAS commiter.

## 🆘 En cas de problème

Si vous voyez toujours "MODE DE TEST" :
1. Vérifiez que toutes les clés commencent par `sk_live_` et `pk_live_` (pas `sk_test_` ou `pk_test_`)
2. Vérifiez que les Price ID sont bien ceux de production
3. Vérifiez que vous avez bien redéployé après avoir ajouté les variables
4. Vérifiez que les variables sont bien assignées à l'environnement "Production" sur Vercel
