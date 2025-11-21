# Diagnostic Domaine Personnalisé vs Vercel

## Problème
- ✅ Fonctionne sur : `https://biliboo-saas-zto3-m0mntbo7b-stove83130-7604s-projects.vercel.app`
- ❌ Ne fonctionne pas sur : `https://bilibou.com`

## Causes possibles

### 1. Configuration Supabase Dashboard

**Vérifier dans Supabase Dashboard → Authentication → URL Configuration :**

#### Site URL
Doit être :
```
https://bilibou.com
```

#### Redirect URLs
Doit inclure :
```
https://bilibou.com/auth/callback
https://bilibou.com/auth/callback?next=/dashboard
https://biliboo-saas-zto3-m0mntbo7b-stove83130-7604s-projects.vercel.app/auth/callback
https://biliboo-saas-zto3-m0mntbo7b-stove83130-7604s-projects.vercel.app/auth/callback?next=/dashboard
```

### 2. Configuration Google OAuth

**Dans Google Cloud Console → Credentials → OAuth 2.0 Client ID :**

**Authorized redirect URIs** doit inclure :
```
https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/callback
```

⚠️ **IMPORTANT** : L'URI doit pointer vers Supabase, pas vers votre domaine !

### 3. Cookies et Domain

Les cookies Supabase sont définis avec le domaine du site. Si le domaine n'est pas correctement configuré dans Supabase, les cookies peuvent ne pas être définis correctement.

### 4. Vérification

1. Ouvrir la console du navigateur sur `bilibou.com`
2. Aller dans Application → Cookies
3. Vérifier si les cookies `sb-*-auth-token` sont présents
4. Vérifier le domaine des cookies (doit être `bilibou.com`)

### 5. Solution

Le problème vient probablement de la configuration Supabase. Il faut :
1. Mettre à jour le Site URL dans Supabase Dashboard
2. Ajouter les Redirect URLs pour bilibou.com
3. Redéployer ou attendre la propagation

