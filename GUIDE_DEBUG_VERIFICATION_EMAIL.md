# 🔍 Guide de Diagnostic : Vérification d'Email

## Problème
L'email de confirmation ne fonctionne pas correctement après le clic sur le lien dans Gmail.

## Étapes de Diagnostic

### 1. Vérifier le lien dans l'email Gmail

**Ouvrez l'email de confirmation dans Gmail et vérifiez le lien :**

1. Cliquez-droit sur le bouton/lien de confirmation
2. Choisissez "Copier l'adresse du lien"
3. Collez le lien quelque part pour l'examiner

**Le lien devrait ressembler à :**
```
https://qkpfxpuhrjgctpadxslh.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=https://www.bilibou.com/auth/callback
```

**Vérifiez :**
- ✅ Le lien contient `type=signup`
- ✅ Le lien contient `redirect_to=https://www.bilibou.com/auth/callback` (ou votre domaine)
- ✅ Le token est présent

### 2. Vérifier la Configuration Supabase Dashboard

**Allez sur Supabase Dashboard :**
1. **Authentication** → **URL Configuration**
2. Vérifiez :

#### Site URL (Production)
```
https://www.bilibou.com
```
OU
```
https://votre-domaine.vercel.app
```

#### Redirect URLs (Autorisées)
Doit contenir :
```
http://localhost:3001/auth/callback
https://www.bilibou.com/auth/callback
https://votre-domaine.vercel.app/auth/callback
```

### 3. Vérifier les Logs Vercel

**Après avoir cliqué sur le lien de confirmation :**

1. Allez sur Vercel → Votre projet → **Deployments** → Cliquez sur le dernier déploiement
2. Ouvrez les **Logs**
3. Cherchez les logs avec `📧` (emojis de logs)
4. Vérifiez :
   - `📧 Email confirmation detected` apparaît
   - `✅ Code échangé avec succès` apparaît
   - `✅✅✅ Email confirmé avec succès` apparaît
   - Ou s'il y a des erreurs `❌`

### 4. Vérifier la Console du Navigateur

**Après avoir cliqué sur le lien :**

1. Ouvrez les DevTools (F12)
2. Onglet **Console**
3. Cherchez les logs avec `🔍` (emojis de logs)
4. Vérifiez :
   - `🔍 Vérification confirmation email:` apparaît
   - `has_confirmed_at: true` ou `false`
   - `email_confirmed_at` contient une date ou `null`

### 5. Vérifier dans Supabase Dashboard

**Vérifier si l'email est vraiment confirmé :**

1. Allez sur Supabase Dashboard
2. **Authentication** → **Users**
3. Trouvez votre utilisateur (par email)
4. Vérifiez :
   - **Email Confirmed** : doit être `true` ✅
   - **Confirmed At** : doit contenir une date/heure

### 6. Test Manuel du Flux

**Testez étape par étape :**

1. **Inscription** :
   - Inscrivez-vous avec un nouvel email
   - Vérifiez que vous êtes redirigé vers `/verify-email`
   - Vérifiez que l'email est affiché

2. **Email de confirmation** :
   - Ouvrez Gmail
   - Cliquez sur le lien de confirmation
   - **Regardez l'URL dans la barre d'adresse** :
     - Doit être `/auth/callback?code=xxx&type=signup`
     - Puis doit rediriger vers `/verify-email?confirmed=true`

3. **Page de vérification** :
   - Vérifiez que le message "Email confirmé !" apparaît
   - Vérifiez que vous êtes redirigé vers `/onboarding` après 2 secondes

### 7. Problèmes Possibles et Solutions

#### Problème : Le lien ne pointe pas vers `/auth/callback`
**Solution :** Vérifiez que `emailRedirectTo` est bien configuré dans `signUp()` et `resend()`

#### Problème : Le callback retourne une erreur
**Solution :** Vérifiez les logs Vercel pour voir l'erreur exacte

#### Problème : `email_confirmed_at` est toujours `null`
**Solution :** 
- Vérifiez que `exchangeCodeForSession` réussit
- Vérifiez que le code n'a pas expiré (les codes expirent après quelques minutes)
- Essayez de renvoyer un nouvel email de confirmation

#### Problème : La page ne se met pas à jour automatiquement
**Solution :** 
- Vérifiez que le polling fonctionne (logs dans la console)
- Vérifiez que les event listeners `visibilitychange` et `focus` sont actifs

## Informations à Collecter

**Pour diagnostiquer, j'ai besoin de :**

1. **Le lien complet** dans l'email Gmail (copiez-le)
2. **Les logs Vercel** après avoir cliqué sur le lien
3. **Les logs de la console** du navigateur
4. **Le statut dans Supabase Dashboard** (email confirmé ou non)
5. **L'URL finale** après avoir cliqué sur le lien (dans la barre d'adresse)

## Commandes Utiles pour Debug

**Dans la console du navigateur (sur `/verify-email`) :**
```javascript
// Vérifier l'état de l'utilisateur
const supabase = window.supabase || (await import('/lib/supabase/client')).createClient();
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);
console.log('Email confirmed:', !!user?.email_confirmed_at);
console.log('Email confirmed at:', user?.email_confirmed_at);
```

