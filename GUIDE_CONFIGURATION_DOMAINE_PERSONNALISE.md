# Guide de Configuration pour Domaine Personnalisé

## Problème identifié
Les bugs persistent sur `bilibou.com` mais fonctionnent sur le domaine Vercel. Cela indique un problème de configuration lié au domaine personnalisé.

## Solutions appliquées

### 1. Configuration des cookies
Les cookies sont maintenant configurés avec :
- `secure: true` en production (HTTPS requis)
- `sameSite: 'lax'` pour la compatibilité cross-site
- `path: '/'` pour être accessible sur tout le site
- **IMPORTANT** : Pas de `domain` explicite - le navigateur gère automatiquement

### 2. Configuration Supabase Dashboard

#### URLs de redirection OAuth
Dans Supabase Dashboard → Authentication → URL Configuration :

**Site URL :**
```
https://bilibou.com
```

**Redirect URLs (ajouter toutes ces URLs) :**
```
https://bilibou.com/auth/callback
https://bilibou.com/auth/callback?next=/dashboard
http://localhost:3001/auth/callback
http://localhost:3001/auth/callback?next=/dashboard
```

#### Provider Google OAuth
Dans Supabase Dashboard → Authentication → Providers → Google :

**Authorized redirect URIs (dans Google Cloud Console) :**
```
https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/callback
```

**IMPORTANT** : L'URI de redirection Google doit pointer vers Supabase, pas vers votre domaine !

### 3. Vérification Vercel

Dans Vercel Dashboard → Settings → Domains :

1. Vérifier que `bilibou.com` est bien configuré
2. Vérifier que le certificat SSL est valide
3. Vérifier que la redirection HTTPS est activée

### 4. Variables d'environnement

Vérifier dans Vercel Dashboard → Settings → Environment Variables :

- `NEXT_PUBLIC_SUPABASE_URL` : Doit être identique pour tous les environnements
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Doit être identique pour tous les environnements

### 5. Test

1. Vider le cache du navigateur pour `bilibou.com`
2. Supprimer tous les cookies pour `bilibou.com`
3. Tester la connexion avec email/password
4. Tester la connexion avec Google OAuth

## Diagnostic

Si le problème persiste, vérifier :

1. **Console navigateur** : Erreurs CORS ou cookies
2. **Network tab** : Vérifier les headers des requêtes Supabase
3. **Supabase Dashboard → Logs → Auth** : Voir les erreurs d'authentification
4. **Vercel Logs** : Vérifier les erreurs serveur

## Points critiques

- Les cookies doivent être `secure: true` en production (HTTPS)
- Ne PAS définir `domain` explicitement dans les options de cookies
- Les URLs de redirection Supabase doivent inclure le domaine personnalisé
- L'URI de redirection Google doit pointer vers Supabase, pas vers votre domaine

