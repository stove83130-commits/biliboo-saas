# Guide de Vérification Production

## 1. Configuration Supabase OAuth

### URLs de redirection à configurer dans Supabase Dashboard :

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Authentication** → **URL Configuration**
4. Dans **Redirect URLs**, ajoutez :
   - `https://www.bilibou.com/auth/callback`
   - `https://bilibou.com/auth/callback`
   - `http://localhost:3001/auth/callback` (pour le dev)

### Providers OAuth (Google/Azure) :

1. Allez dans **Authentication** → **Providers**
2. Pour **Google** :
   - Vérifiez que le provider est activé
   - Vérifiez les **Client ID** et **Client Secret**
   - Dans **Redirect URLs** de Google Cloud Console, ajoutez :
     - `https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/callback`
3. Pour **Azure** :
   - Même chose pour Azure AD

## 2. Variables d'environnement Vercel

Dans Vercel Dashboard → Settings → Environment Variables, vérifiez :

- `NEXT_PUBLIC_SUPABASE_URL` = `https://qkpfxpuhrjgctpadxslh.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (votre clé anon)
- `NEXT_PUBLIC_APP_URL` = `https://www.bilibou.com` (ou `https://bilibou.com`)
- `NEXT_PUBLIC_SITE_URL` = `https://www.bilibou.com` (ou `https://bilibou.com`)

## 3. Problèmes courants

### Erreur "Invalid redirect URL"
→ Vérifiez que l'URL est bien dans la liste des Redirect URLs de Supabase

### Erreur "refresh_token_not_found"
→ Normal pour les utilisateurs non connectés, peut être ignoré

### Cookies non persistants
→ Vérifiez que le domaine est correct et que les cookies sont en HTTPS

