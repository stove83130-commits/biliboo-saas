# Guide : Diagnostic Mode Test alors que clés sont en Production

## 🔍 Problème
La clé secrète est bien `sk_live_...` mais Stripe Checkout affiche toujours "Environnement de test".

## ✅ Vérifications étape par étape

### 1. Vérifier les variables dans Vercel

1. **Vercel Dashboard** → Votre projet → **Settings** → **Environment Variables**
2. Cherchez `STRIPE_SECRET_KEY`
3. **IMPORTANT :** Vérifiez qu'il n'y a **PAS plusieurs entrées** :
   - Une pour "Production"
   - Une pour "Preview"  
   - Une pour "Development"
   
4. Si vous avez plusieurs entrées, vérifiez leurs valeurs :
   - Toutes doivent commencer par `sk_live_`
   - Si une seule est en `sk_test_`, cela peut causer le problème

### 2. Vérifier quel environnement est utilisé

1. **Vercel Dashboard** → **Deployments**
2. Cliquez sur votre dernier déploiement
3. Regardez l'onglet **Build Logs** ou **Function Logs**
4. Cherchez les logs avec `🔑 Configuration Stripe:`
5. Vérifiez :
   - `isProduction: true` ou `false`
   - `environment: production` ou `preview`

### 3. Vérifier les logs en temps réel

1. **Vercel Dashboard** → **Functions** → **Logs**
2. Lancez une tentative de paiement sur votre site
3. Filtrez par `/api/billing/checkout`
4. Regardez les logs qui apparaissent
5. Cherchez le log `🔑 Configuration Stripe:` - il vous dira exactement quelle clé est utilisée

### 4. Vérifier le cache

**Possibilités de cache :**
- Cache navigateur
- Cache Vercel
- Variables d'environnement pas encore rechargées

**Solutions :**
1. **Vider le cache navigateur** : Ctrl+Shift+Del ou navigation privée
2. **Forcer un nouveau déploiement** : Vercel → Deployments → Redeploy
3. **Attendre quelques minutes** après modification des variables

### 5. Vérifier les Price ID

Même si la clé est en production, si les Price ID sont de test, Stripe peut afficher un message confus.

1. **Stripe Dashboard** (mode Production) → **Products**
2. Vérifiez que tous vos Price ID existent bien en production
3. Si un Price ID n'existe qu'en test, créez-le en production

### 6. Vérifier la clé publishable

Côté client, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` doit aussi être en production (`pk_live_`).

## 🎯 Diagnostic via les logs (après le prochain déploiement)

Les logs que j'ai ajoutés vous diront exactement ce qui se passe :

1. Testez un paiement
2. Regardez **Vercel Functions Logs**
3. Cherchez ces logs :
   ```
   🔑 Configuration Stripe: {
     keyPrefix: "sk_live_51...",
     isProduction: true/false,
     isTest: true/false,
     environment: "production" ou autre
   }
   ```

4. **Si `isTest: true`** → La clé utilisée est bien en test, même si vous pensez avoir mis à jour
5. **Si `isProduction: true`** mais toujours "Environnement de test" → C'est un autre problème (Price ID, cache, etc.)

## 🔧 Solutions possibles

### Solution 1 : Vérifier qu'il n'y a qu'une seule variable

Dans Vercel :
1. Settings → Environment Variables
2. Si vous voyez plusieurs `STRIPE_SECRET_KEY` :
   - Supprimez celles en mode test
   - Gardez seulement celle en `sk_live_`
   - Assurez-vous qu'elle est assignée à "Production, Preview, Development"

### Solution 2 : Forcer un nouveau déploiement

1. **Vercel Dashboard** → **Deployments**
2. Cliquez sur les **3 points** du dernier déploiement
3. **Redeploy** (pas juste un rebuild)
4. Attendez que ce soit terminé
5. Testez à nouveau

### Solution 3 : Vérifier les Price ID

Même avec une clé de production, si vous utilisez des Price ID de test :
- Stripe peut afficher un message confus
- La session peut être rejetée

Vérifiez dans Stripe Dashboard (mode Production) que tous vos Price ID existent.

## 🚨 Cas particuliers

### Vercel Preview Deployments

Si vous testez sur une URL de preview (`.vercel.app`), Vercel peut utiliser les variables de "Preview" au lieu de "Production".

**Solution :** Vérifiez que `STRIPE_SECRET_KEY` pour "Preview" est aussi en `sk_live_` ou testez sur votre domaine de production.

### Cache de variables d'environnement

Parfois Vercel met du temps à recharger les variables.

**Solution :** 
1. Modifiez légèrement une variable (ajoutez un espace, puis enlevez-le)
2. Sauvegardez
3. Redéployez

## 📋 Checklist complète

- [ ] `STRIPE_SECRET_KEY` dans Vercel commence par `sk_live_`
- [ ] Il n'y a qu'une seule variable `STRIPE_SECRET_KEY` (ou toutes sont en production)
- [ ] La variable est assignée à "Production"
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` commence par `pk_live_`
- [ ] Tous les Price ID existent en production dans Stripe Dashboard
- [ ] Nouveau déploiement effectué après modifications
- [ ] Cache navigateur vidé ou navigation privée
- [ ] Logs Vercel vérifiés pour confirmer quelle clé est utilisée

