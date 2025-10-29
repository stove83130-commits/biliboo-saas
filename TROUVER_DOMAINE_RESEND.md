# Comment Trouver Votre Domaine Vérifié dans Resend

## 🔍 ÉTAPE 1 : Voir votre domaine dans Resend

### 1.1 Ouvrir Resend
1. Allez sur **https://resend.com**
2. Connectez-vous
3. Vous arrivez sur le **Dashboard**

### 1.2 Accéder à la section Domains
1. Dans le menu de gauche, cliquez sur **"Domains"** (ou "Domaines")
2. Vous verrez une liste avec votre/vos domaines

### 1.3 Voir les détails
1. Cliquez sur votre domaine dans la liste
2. Vous verrez :
   - Le **nom du domaine** (ex: `bilibou.com`)
   - Le **statut** : ✅ "Verified" (Vérifié)
   - Des informations sur le domaine

---

## 📧 ÉTAPE 2 : Comprendre les emails que vous pouvez utiliser

Une fois votre domaine vérifié, vous pouvez utiliser **n'importe quel préfixe** avant `@votre-domaine.com` :

### Exemples avec le domaine `bilibou.com` :

✅ **noreply@bilibou.com** ← Pour les emails automatiques (invitations, etc.)
✅ **contact@bilibou.com** ← Pour le support
✅ **hello@bilibou.com** ← Pour les communications générales
✅ **info@bilibou.com** ← Pour les informations
✅ **support@bilibou.com** ← Pour l'assistance

### ⚠️ Important :
- Vous **n'avez pas besoin de créer** ces emails dans Resend
- Resend accepte automatiquement **tous les préfixes** avec un domaine vérifié
- Il suffit d'utiliser l'adresse complète dans vos variables Vercel

---

## 🎯 ÉTAPE 3 : Quelle adresse utiliser pour vos invitations ?

### Recommandation : `noreply@votre-domaine.com`

**Pourquoi ?**
- C'est une convention standard pour les emails automatiques
- Les utilisateurs comprennent qu'ils ne doivent pas répondre
- C'est professionnel

### Alternative : `contact@votre-domaine.com`

Si vous voulez que les utilisateurs puissent vous contacter via cet email, utilisez `contact@votre-domaine.com` au lieu de `noreply@...`

---

## 📝 Exemple Concret

Si dans Resend vous voyez que votre domaine vérifié est :
```
bilibou.com ✅ Verified
```

Alors dans Vercel, vous devez mettre :
- `EXPORTS_FROM_EMAIL` = `noreply@bilibou.com`
- `INVITES_FROM_EMAIL` = `noreply@bilibou.com`

**Remplacez `bilibou.com` par VOTRE vrai domaine !**

---

## 🔍 Comment être sûr de votre domaine ?

Dans Resend → Domains, vous verrez exactement le nom de votre domaine :

```
+-------------------+
| Domains           |
+-------------------+
|                   |
| bilibou.com ✅    |  ← C'est votre domaine !
| Verified          |
|                   |
+-------------------+
```

Le nom qui apparaît là, c'est celui que vous devez utiliser après le `@` dans vos emails !

---

## ❓ Vous ne voyez pas votre domaine ?

Si vous ne voyez pas la section "Domains" ou si la liste est vide :
1. Vérifiez que vous êtes bien connecté au bon compte Resend
2. Vérifiez que vous avez bien ajouté et vérifié votre domaine
3. Si vous venez de vérifier, rafraîchissez la page (F5)

---

## 💡 Astuce : Vérifier les emails envoyés

Dans Resend → **"Logs"** ou **"Emails"**, vous pouvez voir tous les emails envoyés et vérifier :
- L'adresse **From** (expéditeur)
- Si elle utilise bien votre domaine

