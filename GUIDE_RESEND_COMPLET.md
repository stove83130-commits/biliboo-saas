# Guide Complet : Configuration de Resend pour Bilibou

## 📋 Table des matières
1. [Créer un compte Resend](#1-créer-un-compte-resend)
2. [Obtenir votre clé API](#2-obtenir-votre-clé-api)
3. [Vérifier un domaine ou utiliser l'email par défaut](#3-vérifier-un-domaine-ou-utiliser-lemail-par-défaut)
4. [Configurer les variables dans Vercel](#4-configurer-les-variables-dans-vercel)
5. [Tester l'envoi d'emails](#5-tester-lenvoi-demails)

---

## 1. Créer un compte Resend

### Étapes :
1. Allez sur **https://resend.com**
2. Cliquez sur **"Get Started"** ou **"Sign Up"** en haut à droite
3. Choisissez de vous inscrire avec :
   - Votre email Google
   - Ou votre email GitHub
   - Ou créez un compte avec email/mot de passe
4. Remplissez le formulaire et confirmez votre email

### 💡 Conseil
Utilisez votre email professionnel si vous en avez un, c'est plus simple pour la gestion.

---

## 2. Obtenir votre clé API

### Étapes :
1. Une fois connecté à Resend, vous arrivez sur le **Dashboard**
2. Dans le menu de gauche, cliquez sur **"API Keys"** (ou "Clés API")
3. Vous verrez peut-être une clé déjà créée, ou vous devrez en créer une
4. Cliquez sur **"Create API Key"** (ou "+ Add API Key")
5. Donnez-lui un nom : **"Bilibou Production"** (ou autre nom de votre choix)
6. Choisissez les **permissions** :
   - Cochez **"Sending access"** (accès envoi)
   - Vous pouvez aussi cocher **"Full access"** si vous voulez tout gérer
7. Cliquez sur **"Add"** ou **"Create"**
8. ⚠️ **IMPORTANT** : Resend affichera votre clé UNE SEULE FOIS
   - Elle commence par `re_` suivi de lettres et chiffres
   - Exemple : `re_abc123XYZ456def789ghi012`
   - **Copiez-la immédiatement et collez-la dans un fichier texte sécurisé**

### 🔒 Sécurité
- Ne partagez JAMAIS cette clé publiquement
- Ne la commitez JAMAIS dans Git
- Si vous la perdez, supprimez-la et créez-en une nouvelle

---

## 3. Vérifier un domaine ou utiliser l'email par défaut

### Option A : Utiliser l'email par défaut de Resend (Plus simple pour commencer)

Resend vous donne un email par défaut qui fonctionne directement :
- Format : `onboarding@resend.dev`
- ✅ Vous pouvez l'utiliser immédiatement pour tester
- ⚠️ Limitation : Les emails peuvent parfois aller dans les spams

### Option B : Vérifier votre propre domaine (Recommandé pour production)

Si vous avez un domaine (ex: `bilibou.com`) :

1. Dans Resend, allez dans **"Domains"** dans le menu de gauche
2. Cliquez sur **"Add Domain"**
3. Entrez votre domaine (ex: `bilibou.com`) - SANS le `www` ni `http://`
4. Resend vous donnera des enregistrements DNS à ajouter :
   - Allez dans votre hébergeur de domaine (ex: Namecheap, Cloudflare, etc.)
   - Ajoutez les enregistrements TXT et CNAME fournis par Resend
   - Attendez 5-30 minutes que la vérification se fasse
5. Une fois vérifié (statut "Verified" ✓), vous pourrez utiliser :
   - `noreply@bilibou.com`
   - `contact@bilibou.com`
   - etc.

### 🎯 Recommandation pour commencer

Pour commencer rapidement, utilisez **Option A** (`onboarding@resend.dev`) pour tester. Vous pourrez vérifier votre domaine plus tard.

---

## 4. Configurer les variables dans Vercel

### Étapes :

1. **Ouvrez Vercel**
   - Allez sur https://vercel.com
   - Connectez-vous
   - Sélectionnez votre projet Bilibou

2. **Accédez aux variables d'environnement**
   - Cliquez sur **"Settings"** (Paramètres)
   - Dans le menu de gauche, cliquez sur **"Environment Variables"**

3. **Supprimez les anciennes variables (noms en français)** si elles existent :
   - `HÔTE SMTP`
   - `PORT SMTP`
   - `SMTP_SÉCURISÉ`
   - `UTILISATEUR SMTP`
   - `EXPORTATIONS_DEPUIS_EMAIL`
   - (Gardez `SMTP_PASS` et `SMTP_FROM` si vous les utilisez pour un fallback)

4. **Ajoutez/modifiez les variables Resend** :

   a) **RESEND_API_KEY**
   - Cliquez sur **"Add New"**
   - Name: `RESEND_API_KEY`
   - Value: Collez votre clé API Resend (celle qui commence par `re_`)
   - Environnements: Sélectionnez **"Production"**, **"Preview"**, et **"Development"** (ou au minimum Production)
   - Cliquez sur **"Save"**

   b) **EXPORTS_FROM_EMAIL**
   - Cliquez sur **"Add New"**
   - Name: `EXPORTS_FROM_EMAIL`
   - Value: 
     - Si vous utilisez l'email par défaut : `onboarding@resend.dev`
     - Si vous avez vérifié un domaine : `noreply@votre-domaine.com`
   - Environnements: Sélectionnez tous
   - Cliquez sur **"Save"**

   c) **INVITES_FROM_EMAIL** (Optionnel - mais recommandé)
   - Cliquez sur **"Add New"**
   - Name: `INVITES_FROM_EMAIL`
   - Value: Même valeur que `EXPORTS_FROM_EMAIL`
   - Environnements: Sélectionnez tous
   - Cliquez sur **"Save"**

5. **Vérifiez vos variables**
   - Vous devriez avoir au minimum :
     - ✅ `RESEND_API_KEY`
     - ✅ `EXPORTS_FROM_EMAIL`
     - (Optionnel : `INVITES_FROM_EMAIL`)

---

## 5. Tester l'envoi d'emails

### Après avoir configuré les variables :

1. **Redéployez votre application**
   - Dans Vercel, allez dans **"Deployments"**
   - Cliquez sur les trois points (...) du dernier déploiement
   - Cliquez sur **"Redeploy"** (ou attendez le prochain push Git)

2. **Testez une invitation**
   - Allez sur votre site en production
   - Créez/allez dans une organisation
   - Essayez d'inviter un membre avec votre propre email de test
   - Vous devriez recevoir l'email d'invitation

3. **Vérifiez les logs**
   - Dans Vercel, allez dans **"Functions"** → **"Logs"**
   - Cherchez les messages commençant par `✅ Email d'invitation envoyé via Resend`
   - Si vous voyez `❌ Erreur Resend:`, notez le message d'erreur

---

## 🔧 Troubleshooting

### Problème : "Invalid API key"
- Vérifiez que vous avez bien copié toute la clé (elle doit commencer par `re_`)
- Vérifiez que vous n'avez pas d'espaces avant/après la clé
- Créez une nouvelle clé API dans Resend si nécessaire

### Problème : "Domain not verified"
- Si vous utilisez un domaine personnalisé, vérifiez qu'il est bien vérifié dans Resend
- Utilisez temporairement `onboarding@resend.dev` pour tester

### Problème : L'email n'arrive pas
1. Vérifiez les **logs Vercel** pour voir s'il y a des erreurs
2. Vérifiez le **dashboard Resend** → **"Logs"** pour voir l'état de l'envoi
3. Vérifiez vos **spams/courrier indésirable**
4. Essayez avec une autre adresse email

### Problème : "From email address not authorized"
- Utilisez un email vérifié dans Resend
- Pour tester, utilisez `onboarding@resend.dev`
- Si vous utilisez votre domaine, assurez-vous qu'il est vérifié

---

## 📊 Vérifier les envois dans Resend

Pour voir tous les emails envoyés :
1. Allez sur votre dashboard Resend
2. Cliquez sur **"Logs"** ou **"Emails"**
3. Vous verrez tous les emails envoyés, leur statut (délivré, ouvert, etc.)

---

## 💰 Plans et limites Resend

### Plan Gratuit
- ✅ 3,000 emails/mois
- ✅ 100 emails/jour
- ✅ Support par email
- ✅ Logs d'emails

### Plans payants (si besoin)
- Commencent à $20/mois pour 50,000 emails

Pour commencer, le plan gratuit est largement suffisant !

---

## ✅ Checklist finale

- [ ] Compte Resend créé
- [ ] Clé API Resend copiée (commence par `re_`)
- [ ] Variable `RESEND_API_KEY` ajoutée dans Vercel
- [ ] Variable `EXPORTS_FROM_EMAIL` ajoutée dans Vercel
- [ ] Application redéployée sur Vercel
- [ ] Test d'invitation effectué
- [ ] Email reçu (ou vérifié dans les logs)

---

## 🎉 Une fois tout configuré

Vos invitations fonctionneront automatiquement ! Le système utilisera Resend en priorité, et si ça échoue, il essaiera SMTP en fallback (si configuré).

