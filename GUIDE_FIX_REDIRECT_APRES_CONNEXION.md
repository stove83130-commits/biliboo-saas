# 🔧 Guide : Corriger la redirection après connexion

## 🔍 Problème
Après une connexion réussie (email/password ou OAuth), l'utilisateur est redirigé vers la page d'accueil `/` au lieu du dashboard `/dashboard`.

## ✅ Solution

### 1. Vérifier la configuration Supabase (Dashboard)

Allez sur votre dashboard Supabase :
1. **Authentication** → **URL Configuration**
2. Vérifiez les URL suivantes :

#### **Site URL (Production)**
```
https://votre-app.vercel.app
```
OU
```
https://votre-domaine.com
```

#### **Redirect URLs (Autorisées)**
Ajoutez ces URL :
```
http://localhost:3001/auth/callback
https://votre-app.vercel.app/auth/callback
https://votre-domaine.com/auth/callback
```

### 2. Vérifier les providers OAuth

#### **Google OAuth**
Dans Google Cloud Console :
- **Authorized redirect URIs** doit contenir :
  ```
  https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/callback
  https://votre-app.vercel.app/auth/callback
  ```

#### **Microsoft Azure OAuth**
Dans Azure App Registrations :
- **Redirect URIs** doit contenir :
  ```
  https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/callback
  https://votre-app.vercel.app/auth/callback
  ```

### 3. Variables d'environnement Vercel

Dans Vercel → Settings → Environment Variables :
```bash
NEXT_PUBLIC_BASE_URL=https://votre-app.vercel.app
# OU
NEXT_PUBLIC_BASE_URL=https://votre-domaine.com
```

### 4. Tester la connexion

#### **Test connexion email/password :**
1. Allez sur `/auth/login`
2. Connectez-vous avec email et mot de passe
3. Vous devriez être redirigé vers `/dashboard`

#### **Test connexion OAuth :**
1. Allez sur `/auth/login`
2. Cliquez sur "Continuer avec Google" ou "Microsoft"
3. Autorisez l'application
4. Vous devriez être redirigé vers `/auth/callback`
5. Puis automatiquement vers `/dashboard`

## 🐛 Si ça ne fonctionne toujours pas

### Vérifier les logs Vercel
1. Allez dans **Deployments** sur Vercel
2. Cliquez sur le dernier déploiement
3. Allez dans **Function Logs**
4. Cherchez les erreurs liées à `/auth/callback`

### Vérifier les cookies
1. Ouvrez les DevTools (F12)
2. **Application** → **Cookies**
3. Vérifiez que les cookies Supabase sont présents :
   - `sb-access-token`
   - `sb-refresh-token`

### Forcer la redirection côté client

Si le problème persiste, vous pouvez forcer la redirection dans le callback en modifiant `app/auth/callback/route.ts` :

```typescript
// Au lieu de :
return NextResponse.redirect(`${origin}/dashboard`)

// Essayez :
return NextResponse.redirect(`${origin}/dashboard`, { status: 302 })
```

## ✅ Checklist finale

- [ ] Site URL configuré dans Supabase
- [ ] Redirect URLs ajoutées dans Supabase
- [ ] Google OAuth Redirect URIs configurées
- [ ] Azure OAuth Redirect URIs configurées
- [ ] NEXT_PUBLIC_BASE_URL dans Vercel
- [ ] Test connexion email/password OK
- [ ] Test connexion OAuth OK

