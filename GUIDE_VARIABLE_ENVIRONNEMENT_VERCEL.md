# 🔧 Guide : Configuration NEXT_PUBLIC_APP_URL dans Vercel

## 🎯 Valeur à Configurer

Pour la **production** dans Vercel, vous devez mettre :

```
NEXT_PUBLIC_APP_URL=https://bilibou.com
```

**⚠️ IMPORTANT :** Sans `http://` ou `https://` au début, juste l'URL complète avec le protocole.

## 📋 Étapes dans Vercel Dashboard

### 1. Accéder aux Variables d'Environnement

1. Allez sur [Vercel Dashboard](https://vercel.com)
2. Sélectionnez votre projet **biliboo-saas**
3. Allez dans **Settings** → **Environment Variables**

### 2. Modifier NEXT_PUBLIC_APP_URL

1. Cherchez la variable `NEXT_PUBLIC_APP_URL`
2. Si elle existe, cliquez sur elle pour la modifier
3. Si elle n'existe pas, cliquez sur **"Add New"**

### 3. Configurer la Valeur

**Pour la PRODUCTION :**
- **Key** : `NEXT_PUBLIC_APP_URL`
- **Value** : `https://bilibou.com`
- **Environment** : Cochez **Production** (et peut-être **Preview** si vous voulez tester les previews)

**Pour le DÉVELOPPEMENT LOCAL :**
- Vous pouvez créer une variable séparée pour **Development**
- **Value** : `http://localhost:3001`
- **Environment** : Cochez **Development**

OU simplement laissez le code gérer le développement local (il utilise `http://localhost:3001` par défaut).

### 4. Sauvegarder

1. Cliquez sur **"Save"**
2. Les changements prendront effet au prochain déploiement

## 🔄 Redéployer

Après avoir modifié la variable :

1. **Option 1** : Attendez le prochain push sur `main` (redéploiement automatique)
2. **Option 2** : Allez dans **Deployments** → Trouvez le dernier déploiement → Cliquez sur **"Redeploy"**

## ✅ Vérification

Après le redéploiement, testez la connexion Gmail et vérifiez les logs Vercel :

1. Allez dans **Functions** → **Logs**
2. Cherchez le log : `✅ Utilisation NEXT_PUBLIC_APP_URL (domaine personnalisé): https://bilibou.com`
3. Et : `🔗 URI de redirection Gmail finale: https://bilibou.com/api/gmail/callback`

Si vous voyez ces logs, c'est que la configuration est correcte !

## 🐛 Si ça ne marche toujours pas

### Vérifier que la variable est bien définie

1. Vercel Dashboard → Settings → Environment Variables
2. Vérifiez que `NEXT_PUBLIC_APP_URL` est bien défini pour **Production**
3. Vérifiez que la valeur est exactement : `https://bilibou.com` (avec `https://`, sans espace)

### Vérifier les logs

Les logs Vercel devraient montrer :
- `✅ Utilisation NEXT_PUBLIC_APP_URL (domaine personnalisé): https://bilibou.com`
- Si vous voyez `⚠️ Utilisation fallback`, c'est que la variable n'est pas correctement chargée

### Redéployer manuellement

1. Vercel Dashboard → Deployments
2. Cliquez sur les **3 points** du dernier déploiement
3. Sélectionnez **"Redeploy"**
4. Attendez la fin du déploiement
5. Testez à nouveau

## 📝 Notes Importantes

- **Ne mettez PAS** `http://localhost:3001` en production
- **Mettez TOUJOURS** `https://bilibou.com` en production (avec `https://`)
- La variable doit être définie pour l'environnement **Production**
- Les changements prennent effet après un redéploiement

## 🎯 Résumé Rapide

1. Vercel Dashboard → Settings → Environment Variables
2. `NEXT_PUBLIC_APP_URL` = `https://bilibou.com` (pour Production)
3. Sauvegarder
4. Redéployer (ou attendre le prochain push)
5. Tester la connexion Gmail
6. Vérifier les logs Vercel

