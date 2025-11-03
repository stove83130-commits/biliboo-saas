# Guide : Problème avec Domaine Personnalisé vs Vercel

## 🔍 Problème

Le checkout Stripe fonctionne sur `xxx.vercel.app` mais pas sur `bilibou.com`.

## 🔴 Causes Possibles

### 1. Domaines non autorisés dans Stripe (Le plus probable)

Stripe vérifie que les URLs `cancel_url` et `success_url` sont dans des domaines autorisés.

**Solution :**
1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com) → Mode **Production**
2. Allez dans **Settings** → **Checkout**
3. Cherchez la section **"Allowed domains"** ou **"Domaines autorisés"**
4. Vérifiez que `bilibou.com` est bien dans la liste
5. Si non, ajoutez-le :
   - Cliquez sur **"Add domain"** ou **"Ajouter un domaine"**
   - Entrez `bilibou.com` (sans `www`, sans `http://`)
   - Sauvegardez

### 2. Variables d'environnement différentes

Vercel peut avoir des variables différentes pour le domaine personnalisé.

**Solution :**
1. Vercel Dashboard → Settings → Environment Variables
2. Vérifiez que toutes les variables sont assignées à **Production**
3. Vérifiez que `NEXT_PUBLIC_APP_URL` n'est pas défini sur `localhost` ou le domaine Vercel

### 3. Headers différents selon le domaine

Les headers `origin` peuvent différer entre `xxx.vercel.app` et `bilibou.com`.

**Solution :** Vérifiez les logs Vercel pour voir les valeurs exactes :
- Allez dans Vercel → Functions → Logs
- Cherchez `🔙 URL de retour (cancelUrl) - DEBUG COMPLET:`
- Comparez les valeurs entre les deux domaines

### 4. Configuration DNS / Redirect

Le domaine `bilibou.com` peut rediriger vers un autre domaine ou avoir une mauvaise configuration.

**Solution :**
1. Vérifiez dans Vercel → Settings → Domains que `bilibou.com` est bien configuré
2. Vérifiez que le DNS pointe bien vers Vercel
3. Testez : `curl -I https://bilibou.com` pour voir les headers

## ✅ Solutions Étape par Étape

### Étape 1 : Autoriser le domaine dans Stripe (CRITIQUE)

1. **Stripe Dashboard** → Mode **Production**
2. **Settings** → **Checkout**
3. Section **"Allowed domains"**
4. Si `bilibou.com` n'est pas dans la liste :
   - Cliquez sur **"Add domain"**
   - Entrez : `bilibou.com`
   - Sauvegardez

### Étape 2 : Vérifier les Variables Vercel

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Vérifiez `NEXT_PUBLIC_APP_URL` :
   - Si défini, il doit être `https://bilibou.com` (pas localhost, pas vercel.app)
   - Ou supprimez-le complètement pour que le code utilise les headers

### Étape 3 : Vérifier les Logs

1. Testez depuis `bilibou.com`
2. Vercel → Functions → Logs
3. Cherchez `🔙 URL de retour (cancelUrl) - DEBUG COMPLET:`
4. Vérifiez :
   - `baseUrl` contient bien `https://bilibou.com`
   - `cancelUrl` contient bien `https://bilibou.com/...`
   - Pas de référence à `localhost` ou `vercel.app`

### Étape 4 : Vérifier la Configuration Vercel

1. **Vercel Dashboard** → **Settings** → **Domains**
2. Vérifiez que `bilibou.com` est bien listé
3. Vérifiez que le statut est **"Valid Configuration"** ou **"Active"**

## 🎯 Solution Rapide

Le problème vient probablement des domaines autorisés dans Stripe.

**Action immédiate :**
1. Stripe Dashboard (Production) → Settings → Checkout
2. Ajoutez `bilibou.com` dans "Allowed domains"
3. Redéployez sur Vercel
4. Testez

## 📋 Checklist

- [ ] `bilibou.com` ajouté dans Stripe Dashboard → Settings → Checkout → Allowed domains
- [ ] Variables Vercel correctes (pas de localhost)
- [ ] Domaine configuré dans Vercel → Settings → Domains
- [ ] DNS pointe vers Vercel
- [ ] Logs Vercel montrent le bon domaine dans `baseUrl` et `cancelUrl`

## 🔍 Debug

Si ça ne marche toujours pas, vérifiez les logs :
- Les logs montrent quel `baseUrl` est utilisé
- Les logs montrent quel `cancelUrl` est créé
- Comparez entre `xxx.vercel.app` et `bilibou.com`

