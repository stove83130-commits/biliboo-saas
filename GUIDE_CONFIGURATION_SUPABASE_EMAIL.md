# 🔧 Guide : Configuration Supabase pour la Vérification d'Email

## 🔴 Problème Identifié

Le lien dans l'email pointe vers `https://bilibou.com/auth/callback` (sans `www.`), mais Supabase peut ne pas autoriser cette URL si elle n'est pas dans la liste des Redirect URLs autorisées.

## ✅ Solution : Configuration Supabase Dashboard

### 1. Vérifier/Ajouter les Redirect URLs

**Allez sur Supabase Dashboard :**
1. **Authentication** → **URL Configuration**
2. Dans la section **"Redirect URLs"**, ajoutez **TOUTES** ces URLs :

```
http://localhost:3001/auth/callback
https://bilibou.com/auth/callback
https://www.bilibou.com/auth/callback
```

**⚠️ IMPORTANT :** Ajoutez les deux versions (avec et sans `www.`) pour éviter tout problème de cookies/session.

### 2. Vérifier/Ajuster le Site URL

**Dans la section "Site URL" :**
- Mettez : `https://bilibou.com` (sans `www.`)
- OU : `https://www.bilibou.com` (avec `www.`)
- **Important :** Choisissez UN format et utilisez-le partout

**Recommandation :** Utilisez `https://bilibou.com` (sans `www.`) pour la cohérence.

### 3. Vérifier les Variables d'Environnement Vercel

**Dans Vercel → Settings → Environment Variables :**

Assurez-vous que `NEXT_PUBLIC_APP_URL` est défini :
```
NEXT_PUBLIC_APP_URL=https://bilibou.com
```

**OU** supprimez-le complètement pour que le code utilise `window.location.origin` (mais normalisé).

### 4. Redéployer

Après avoir modifié les Redirect URLs dans Supabase :
1. Redéployez sur Vercel (ou attendez quelques minutes)
2. Testez avec un nouvel email de confirmation

## 🔍 Comment Vérifier que ça Marche

### Test 1 : Vérifier le Lien dans l'Email

1. Inscrivez-vous avec un nouvel email
2. Ouvrez l'email de confirmation
3. Clic droit sur le lien → "Copier l'adresse du lien"
4. Vérifiez que le lien contient :
   ```
   redirect_to=https://bilibou.com/auth/callback
   ```
   (ou `https://www.bilibou.com/auth/callback` selon votre configuration)

### Test 2 : Tester le Flux Complet

1. Cliquez sur le lien dans l'email
2. Vérifiez que vous êtes redirigé vers `/auth/callback?code=xxx&type=signup`
3. Vérifiez que vous êtes ensuite redirigé vers `/verify-email?confirmed=true`
4. Vérifiez que le message "Email confirmé !" apparaît
5. Vérifiez que vous êtes redirigé vers `/onboarding` après 2 secondes

### Test 3 : Vérifier les Logs

**Dans Vercel → Deployments → Logs :**
Cherchez les logs avec `📧` :
- `📧 Email confirmation detected`
- `📧 URL de redirection email: https://bilibou.com/auth/callback`
- `✅ Code échangé avec succès`
- `✅✅✅ Email confirmé avec succès`

**Dans la Console du Navigateur (F12) :**
Cherchez les logs avec `🔍` :
- `🔍 Vérification confirmation email:`
- `has_confirmed_at: true`

## 🐛 Si ça ne Marche Toujours Pas

### Vérifier dans Supabase Dashboard

1. **Authentication** → **Users**
2. Trouvez votre utilisateur
3. Vérifiez :
   - **Email Confirmed** : doit être `true` ✅
   - **Confirmed At** : doit contenir une date/heure

### Vérifier les Cookies

**Dans la Console du Navigateur (F12) → Application → Cookies :**

Vérifiez que les cookies Supabase sont présents :
- `sb-{project-ref}-auth-token`
- `sb-{project-ref}-auth-token.0` (si le token est trop long)

### Vérifier le Domaine

**Testez ces commandes :**

```bash
# Vérifier que bilibou.com redirige correctement
curl -I https://bilibou.com

# Vérifier que www.bilibou.com redirige vers bilibou.com (ou vice versa)
curl -I https://www.bilibou.com
```

## 📋 Checklist Complète

- [ ] `https://bilibou.com/auth/callback` ajouté dans Supabase Redirect URLs
- [ ] `https://www.bilibou.com/auth/callback` ajouté dans Supabase Redirect URLs (si vous utilisez www)
- [ ] Site URL configuré dans Supabase (choisir un format : avec ou sans www)
- [ ] `NEXT_PUBLIC_APP_URL` défini dans Vercel (optionnel, mais recommandé)
- [ ] Redéployé sur Vercel
- [ ] Testé avec un nouvel email de confirmation
- [ ] Vérifié que le lien dans l'email contient le bon `redirect_to`
- [ ] Vérifié que le flux fonctionne de bout en bout
- [ ] Vérifié les logs Vercel pour confirmer que `email_confirmed_at` est bien défini

## 💡 Pourquoi Normaliser sans www ?

1. **Cookies :** Les cookies sont partagés entre `bilibou.com` et `www.bilibou.com` si le domaine est `.bilibou.com`, mais Supabase peut avoir des problèmes si les URLs ne correspondent pas exactement.

2. **Cohérence :** Utiliser toujours le même format évite les problèmes de session/cookies.

3. **Simplicité :** Un seul format est plus facile à gérer et à déboguer.

