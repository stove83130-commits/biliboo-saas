# ✅ Votre Domaine est Vérifié ! Étapes Finales

## 🎯 Maintenant, vous devez utiliser votre domaine dans Vercel

---

## ÉTAPE 1 : Déterminer l'email à utiliser

### Quel email voulez-vous utiliser ?

Vous pouvez utiliser **n'importe quel préfixe** avec votre domaine vérifié :
- ✅ `noreply@votre-domaine.com`
- ✅ `contact@votre-domaine.com`
- ✅ `hello@votre-domaine.com`
- ✅ `info@votre-domaine.com`

**Recommandation** : Utilisez `noreply@votre-domaine.com` pour les emails automatiques

---

## ÉTAPE 2 : Configurer dans Vercel

### 2.1 Ouvrir Vercel
1. Allez sur **https://vercel.com**
2. Connectez-vous
3. Sélectionnez votre projet **Bilibou**

### 2.2 Accéder aux variables d'environnement
1. Cliquez sur **"Settings"** (Paramètres) en haut
2. Dans le menu de gauche, cliquez sur **"Environment Variables"**

### 2.3 Modifier/Ajouter les variables

#### Variable 1 : EXPORTS_FROM_EMAIL

**Si la variable existe déjà :**
1. Trouvez `EXPORTS_FROM_EMAIL` dans la liste
2. Cliquez sur les 3 points **"..."** à droite
3. Cliquez sur **"Edit"**
4. Remplacez la valeur :
   - ❌ Ancienne : `onboarding@resend.dev`
   - ✅ Nouvelle : `noreply@votre-domaine.com` (remplacez par VOTRE domaine)
5. Cliquez sur **"Save"**

**Si la variable n'existe pas :**
1. Cliquez sur **"Add New"**
2. **Name** : `EXPORTS_FROM_EMAIL`
3. **Value** : `noreply@votre-domaine.com` (remplacez par VOTRE domaine)
4. **Environnements** : Cochez **Production**, **Preview**, **Development**
5. Cliquez sur **"Save"**

#### Variable 2 : INVITES_FROM_EMAIL (Optionnel mais recommandé)

**Si la variable existe déjà :**
1. Trouvez `INVITES_FROM_EMAIL` dans la liste
2. Cliquez sur **"Edit"**
3. Mettez la même valeur que `EXPORTS_FROM_EMAIL`
4. Cliquez sur **"Save"`

**Si la variable n'existe pas :**
1. Cliquez sur **"Add New"**
2. **Name** : `INVITES_FROM_EMAIL`
3. **Value** : `noreply@votre-domaine.com` (même valeur que EXPORTS_FROM_EMAIL)
4. **Environnements** : Cochez tous
5. Cliquez sur **"Save"**

#### Variable 3 : Vérifier RESEND_API_KEY

Assurez-vous que `RESEND_API_KEY` est bien configurée avec votre clé API Resend (celle qui commence par `re_`)

---

## ÉTAPE 3 : Redéployer l'application

### 3.1 Déclencher un redéploiement
1. Dans Vercel, allez dans **"Deployments"** (Déploiements)
2. Trouvez votre dernier déploiement
3. Cliquez sur les **3 points "..."** à droite
4. Cliquez sur **"Redeploy"**
5. Attendez que le déploiement se termine (2-5 minutes)

---

## ÉTAPE 4 : Tester les invitations

### 4.1 Tester sur votre site
1. Allez sur votre site en production
2. Connectez-vous
3. Créez ou allez dans une organisation
4. Invitez un membre avec **votre propre email de test**
5. Vous devriez recevoir l'email d'invitation

### 4.2 Vérifier dans Resend
1. Allez sur **Resend.com**
2. Cliquez sur **"Logs"** ou **"Emails"** dans le menu
3. Vous devriez voir votre email d'invitation envoyé
4. Vérifiez que l'expéditeur est bien `noreply@votre-domaine.com`

### 4.3 Vérifier dans les logs Vercel
1. Dans Vercel → **"Functions"** → **"Logs"**
2. Cherchez les messages qui commencent par `✅ Email d'invitation envoyé via Resend`
3. Si vous voyez des erreurs, notez le message

---

## 📋 Checklist finale

- [ ] `EXPORTS_FROM_EMAIL` mis à jour avec votre domaine (ex: `noreply@votre-domaine.com`)
- [ ] `INVITES_FROM_EMAIL` ajouté/modifié avec la même valeur
- [ ] `RESEND_API_KEY` bien configurée
- [ ] Application redéployée sur Vercel
- [ ] Test d'invitation effectué
- [ ] Email reçu avec le bon expéditeur

---

## 🎉 C'est terminé !

Maintenant, tous vos emails d'invitation utiliseront votre domaine vérifié au lieu de `onboarding@resend.dev`.

Vos emails auront l'air plus professionnels et auront moins de chances d'aller dans les spams ! ✨

