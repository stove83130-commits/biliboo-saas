# 🔧 Guide : Configuration Google OAuth pour Gmail

## 🔴 Problème : Erreur `redirect_uri_mismatch`

L'erreur `Error 400: redirect_uri_mismatch` signifie que l'URI de redirection utilisée dans le code ne correspond **EXACTEMENT** à aucune URI configurée dans Google Cloud Console.

## ✅ Solution : Configuration Google Cloud Console

### 1. Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** → **Credentials**
4. Trouvez votre **OAuth 2.0 Client ID** (celui utilisé pour Gmail)
5. Cliquez dessus pour l'éditer

### 2. Configurer les Authorized redirect URIs

Dans la section **"Authorized redirect URIs"**, ajoutez **EXACTEMENT** ces URIs :

```
https://bilibou.com/api/gmail/callback
https://www.bilibou.com/api/gmail/callback
http://localhost:3001/api/gmail/callback
```

**⚠️ IMPORTANT :**
- Les URIs doivent correspondre **EXACTEMENT** (même protocole, même domaine, même chemin)
- `https://bilibou.com` et `https://www.bilibou.com` sont considérés comme **différents** par Google
- Ajoutez les **deux versions** (avec et sans www) pour éviter tout problème
- Pour le développement local, ajoutez aussi `http://localhost:3001/api/gmail/callback`

### 3. Vérifier les Authorized JavaScript origins

Dans la section **"Authorized JavaScript origins"**, ajoutez :

```
https://bilibou.com
https://www.bilibou.com
http://localhost:3001
```

### 4. Sauvegarder

1. Cliquez sur **"SAVE"** en bas de la page
2. Attendez quelques minutes pour que les changements prennent effet (propagation)

## 🔍 Vérification dans le Code

Le code normalise maintenant l'URL pour toujours utiliser `https://bilibou.com` (sans www) :

```typescript
// Dans app/api/gmail/connect/route.ts
if (baseUrl.includes('bilibou.com')) {
  baseUrl = baseUrl.replace(/^https?:\/\/(www\.)?/, 'https://')
  if (baseUrl.startsWith('https://www.bilibou.com')) {
    baseUrl = 'https://bilibou.com'
  }
}
```

**Cela signifie que le code utilise TOUJOURS `https://bilibou.com/api/gmail/callback`**

## 📋 Checklist de Configuration

- [ ] URI `https://bilibou.com/api/gmail/callback` ajoutée dans Google Cloud Console
- [ ] URI `https://www.bilibou.com/api/gmail/callback` ajoutée dans Google Cloud Console (pour sécurité)
- [ ] URI `http://localhost:3001/api/gmail/callback` ajoutée pour le développement
- [ ] JavaScript origins `https://bilibou.com` et `https://www.bilibou.com` ajoutés
- [ ] Changements sauvegardés dans Google Cloud Console
- [ ] Attente de quelques minutes pour la propagation
- [ ] Test de connexion Gmail

## 🐛 Si ça ne marche toujours pas

### Vérifier les logs Vercel

1. Allez dans Vercel → Functions → Logs
2. Cherchez le log : `🔗 URI de redirection Gmail:`
3. Vérifiez que l'URI affichée correspond EXACTEMENT à celle dans Google Cloud Console

### Vérifier la variable d'environnement

Dans Vercel → Settings → Environment Variables :
- Vérifiez que `NEXT_PUBLIC_APP_URL` est défini sur `https://bilibou.com` (sans www)
- OU supprimez-la complètement pour que le code utilise les headers

### Test de connexion

1. Allez sur `/dashboard/settings`
2. Cliquez sur "Connecter Gmail"
3. Vérifiez dans les logs Vercel l'URI utilisée
4. Comparez avec celle configurée dans Google Cloud Console

## 🔄 Après Configuration

1. Redéployez sur Vercel (ou attendez quelques minutes)
2. Testez la connexion Gmail
3. L'erreur `redirect_uri_mismatch` devrait être résolue

## 📝 Notes Importantes

- **Google met en cache les configurations** : Les changements peuvent prendre 5-10 minutes pour être pris en compte
- **Sensibilité à la casse** : Les URIs sont sensibles à la casse (majuscules/minuscules)
- **Protocole** : `http://` et `https://` sont considérés comme différents
- **Trailing slash** : `https://bilibou.com/api/gmail/callback` ≠ `https://bilibou.com/api/gmail/callback/`

