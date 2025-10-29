# Guide : Configurer Resend avec IONOS

## 🔍 Explication : "SMS" = TXT

Dans Resend, quand vous voyez **"SMS"** comme type d'enregistrement, c'est en fait **"TXT"** qu'il faut utiliser dans IONOS.

Les enregistrements "SMS" dans Resend sont des enregistrements **TXT** pour :
- DKIM (vérification)
- SPF (vérification d'envoi)
- DMARC (protection anti-spam)

---

## 📋 Résumé de vos enregistrements

D'après votre capture d'écran, vous devez ajouter :

### Section 1 : Vérification de domaine
- **Type** : TXT (pas SMS !)
- **Nom** : `resend._domainkey`
- **Contenu** : Le long texte qui commence par `p=MIGfMA0GCSqGSIb3...`

### Section 2 : Envoi
1. **MX record** :
   - **Type** : MX
   - **Nom** : `resend` (ou laissez vide pour le domaine racine)
   - **Contenu** : `feedback-smtp.eu-ouest...`
   - **Priorité** : 10

2. **SPF record** :
   - **Type** : TXT
   - **Nom** : `resend` (ou laissez vide)
   - **Contenu** : `v=spf1 include:amazons...`

3. **DMARC record** (Facultatif) :
   - **Type** : TXT
   - **Nom** : `_dmarc`
   - **Contenu** : `v=DMARC1; p=none;`

---

## 🚀 Guide Étape par Étape pour IONOS

### ÉTAPE 1 : Se connecter à IONOS

1. Allez sur **https://www.ionos.fr** (ou .com selon votre région)
2. Connectez-vous à votre compte
3. Vous arrivez sur le **Tableau de bord**

### ÉTAPE 2 : Accéder à la gestion DNS

1. Dans le menu de gauche ou sur la page principale, cherchez **"Domaines"** ou **"DNS"**
2. Cliquez dessus
3. Cliquez sur votre domaine dans la liste (celui que vous avez ajouté dans Resend)

### ÉTAPE 3 : Ajouter les enregistrements DNS

Vous verrez une section **"Enregistrements DNS"** ou **"Zone DNS"**.

#### 3.1 Ajouter le TXT pour la vérification DKIM

1. Cliquez sur **"Ajouter un enregistrement"** ou **"+"** ou un bouton similaire
2. Sélectionnez le type **"TXT"**
3. Remplissez :
   - **Nom / Sous-domaine** : `resend._domainkey`
   - **Valeur / Contenu** : Collez TOUT le contenu depuis Resend (commence par `p=MIGfMA0GCSqGSIb3...`)
   - **TTL** : `3600` ou `Auto` (si proposé)
4. Cliquez sur **"Enregistrer"** ou **"Ajouter"**

#### 3.2 Ajouter l'enregistrement MX

1. Cliquez à nouveau sur **"Ajouter un enregistrement"**
2. Sélectionnez le type **"MX"**
3. Remplissez :
   - **Nom / Sous-domaine** : `resend` (ou laissez vide si vous voulez pour le domaine racine)
   - **Valeur / Serveur** : Copiez juste la partie serveur de `feedback-smtp.eu-ouest...` (sans les guillemets)
   - **Priorité** : `10`
   - **TTL** : `3600` ou `Auto`
4. Cliquez sur **"Enregistrer"**

⚠️ **Note** : Si IONOS demande juste "Valeur" pour MX, mettez `feedback-smtp.eu-ouest-X.resend.com` (avec X étant le numéro de région que Resend vous donne)

#### 3.3 Ajouter le TXT pour SPF

1. Cliquez sur **"Ajouter un enregistrement"**
2. Sélectionnez le type **"TXT"**
3. Remplissez :
   - **Nom / Sous-domaine** : `resend` (ou laissez vide pour le domaine racine)
   - **Valeur / Contenu** : Collez `v=spf1 include:amazons...` (tout le contenu depuis Resend)
   - **TTL** : `3600` ou `Auto`
4. Cliquez sur **"Enregistrer"**

#### 3.4 Ajouter le TXT pour DMARC (Facultatif mais recommandé)

1. Cliquez sur **"Ajouter un enregistrement"**
2. Sélectionnez le type **"TXT"**
3. Remplissez :
   - **Nom / Sous-domaine** : `_dmarc`
   - **Valeur / Contenu** : `v=DMARC1; p=none;`
   - **TTL** : `3600` ou `Auto`
4. Cliquez sur **"Enregistrer"**

---

## 📝 Vérification dans IONOS

Après avoir ajouté tous les enregistrements, vous devriez voir dans votre liste DNS :

```
Type  Nom              Valeur
TXT   resend._domainkey  p=MIGfMA0GCSqGSIb3... (long texte)
MX    resend            feedback-smtp.eu-ouest-X.resend.com  (Priorité: 10)
TXT   resend            v=spf1 include:amazons...
TXT   _dmarc            v=DMARC1; p=none;
```

---

## ⏱️ Attendre la propagation

1. Attendez **5-30 minutes** que les DNS se propagent
2. Ne touchez à rien pendant ce temps

---

## ✅ Vérifier dans Resend

1. Retournez sur **Resend.com** → **"Domains"**
2. Cliquez sur votre domaine
3. Cliquez sur **"Verify"** ou **"Vérifier"**
4. Le statut devrait passer à **"Verified"** ✅

---

## ⚠️ Erreurs courantes avec IONOS

### Erreur : "Je ne trouve pas où ajouter les enregistrements"

**Solutions :**
- Cherchez **"DNS"** ou **"Zone DNS"** dans le menu IONOS
- Parfois c'est sous **"Paramètres du domaine"** puis **"DNS"**
- Si vous ne trouvez pas, IONOS a peut-être une FAQ ou support chat

### Erreur : "Le type TXT n'existe pas"

**Solutions :**
- Dans certains hébergeurs, TXT s'appelle **"TXT Record"** ou **"Enregistrement texte"**
- Cherchez dans les types disponibles : TXT, TEXTE, Text Record, etc.

### Erreur : "Le nom ne peut pas contenir de point"

**Solutions :**
- Pour `resend._domainkey`, essayez sans le premier point : `resend_domainkey`
- Ou mettez juste `resend._domainkey` directement si IONOS l'accepte
- Vérifiez la syntaxe exacte dans la documentation IONOS

### Erreur : "Vérification toujours en attente après 30 minutes"

**Solutions :**
1. Vérifiez que vous avez bien copié TOUT le contenu (souvent très long)
2. Vérifiez qu'il n'y a pas d'espaces avant/après dans les valeurs
3. Utilisez un outil de vérification DNS comme **https://mxtoolbox.com** :
   - Entrez votre domaine
   - Vérifiez que les enregistrements TXT apparaissent

---

## 🆘 Si vous êtes bloqué

Si vous rencontrez un problème spécifique dans IONOS, dites-moi :
1. **Quel est le message exact** que vous voyez dans IONOS ?
2. **À quelle étape** vous êtes bloqué ?
3. **Une capture d'écran** de votre interface IONOS m'aiderait beaucoup

Je pourrai alors vous donner des instructions encore plus précises ! 🚀

