# Guide Configuration Google Cloud Console pour Domaine Personnalisé

## ⚠️ PROBLÈME IDENTIFIÉ

Si OAuth Google fonctionne sur le domaine Vercel mais **PAS** sur votre domaine personnalisé (`bilibou.com`), c'est probablement un problème de configuration dans **Google Cloud Console**.

## ✅ VÉRIFICATIONS OBLIGATOIRES

### 1. Domaines autorisés (OAuth Consent Screen)

**Google Cloud Console → APIs & Services → OAuth consent screen**

Dans la section **"Authorized domains"**, vous DEVEZ ajouter :
```
bilibou.com
```

⚠️ **IMPORTANT** : Sans ce domaine dans la liste, Google peut bloquer les redirections depuis `bilibou.com` même si les redirect URIs sont correctement configurés.

### 2. Redirect URIs (OAuth 2.0 Client ID)

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID**

Dans **"Authorized redirect URIs"**, vous devez avoir :
```
https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/callback
```

⚠️ **IMPORTANT** : L'URI doit pointer vers Supabase, **PAS** vers votre domaine personnalisé !

### 3. Vérification Supabase Dashboard

**Supabase Dashboard → Authentication → URL Configuration**

**Site URL :**
```
https://bilibou.com
```

**Redirect URLs :**
```
https://bilibou.com/auth/callback
https://bilibou.com/auth/callback?next=/dashboard
https://biliboo-saas-zto3-m0mntbo7b-stove83130-7604s-projects.vercel.app/auth/callback
https://biliboo-saas-zto3-m0mntbo7b-stove83130-7604s-projects.vercel.app/auth/callback?next=/dashboard
```

## 🔍 DIAGNOSTIC

1. Ouvrir la console du navigateur sur `bilibou.com`
2. Aller dans Application → Cookies
3. Vérifier si les cookies `sb-*-auth-token` sont présents après la tentative de connexion Google
4. Vérifier le domaine des cookies (doit être `bilibou.com`)

## 🚀 SOLUTION

1. **Ajouter `bilibou.com` dans "Authorized domains"** de Google Cloud Console
2. Attendre quelques minutes pour la propagation
3. Vider le cache du navigateur
4. Réessayer la connexion Google sur `bilibou.com`

