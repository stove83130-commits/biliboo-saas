# Guide Étape par Étape : Vérifier Votre Domaine dans Resend

## 📋 Prérequis
- Avoir un domaine (ex: `bilibou.com`, `monentreprise.fr`)
- Avoir accès au panel d'administration de votre domaine (chez votre registrar : OVH, Namecheap, Cloudflare, etc.)
- Avoir créé un compte Resend

---

## ÉTAPE 1 : Ajouter le domaine dans Resend

### 1.1 Ouvrir Resend
1. Allez sur **https://resend.com**
2. Connectez-vous avec votre compte
3. Vous arrivez sur le **Dashboard**

### 1.2 Accéder à la section Domains
1. Dans le menu de gauche, cliquez sur **"Domains"**
   - Si vous ne voyez pas "Domains", cherchez dans le menu ou cliquez sur "Settings" puis "Domains"

### 1.3 Ajouter votre domaine
1. Cliquez sur le bouton **"Add Domain"** (ou "+ Add Domain")
2. Une fenêtre s'ouvre avec un champ de texte
3. Entrez votre domaine :
   - ✅ **Bon** : `bilibou.com` (sans `www`, sans `http://`, sans `https://`)
   - ✅ **Bon** : `monentreprise.fr`
   - ❌ **Mauvais** : `www.bilibou.com`
   - ❌ **Mauvais** : `http://bilibou.com`
   - ❌ **Mauvais** : `https://bilibou.com`
4. Cliquez sur **"Add"** ou **"Continue"**

---

## ÉTAPE 2 : Récupérer les enregistrements DNS

### 2.1 Voir les enregistrements à ajouter
Après avoir ajouté le domaine, Resend affiche une page avec **3 à 5 enregistrements DNS** à ajouter.

Vous verrez quelque chose comme :

```
Type    Name          Value
TXT     @             resend-verification:abc123def456...
TXT     resend        resend-verification:xyz789ghi012...
CNAME   resend._domainkey  resend._domainkey.resend.com
SPF     @             v=spf1 include:spf.resend.com ~all
DMARC   _dmarc        v=DMARC1; p=none;
```

**⚠️ IMPORTANT** : Notez ces informations ou gardez cette page ouverte, vous en aurez besoin !

---

## ÉTAPE 3 : Trouver votre hébergeur DNS / Registrar

### 3.1 Identifier où est hébergé votre domaine

Cela dépend de où vous avez acheté/configuré votre domaine. Voici les cas courants :

**Si votre domaine est :**
- **Sur Vercel** → Vercel utilise Cloudflare automatiquement
- **Sur Cloudflare** → Panel Cloudflare
- **Sur OVH** → Panel OVH
- **Sur Namecheap** → Panel Namecheap
- **Sur Google Domains** → Panel Google
- **Sur ailleurs** → Connectez-vous au panel de votre registrar

### 3.2 Comment savoir où est votre domaine ?
1. Allez sur **https://whois.com** ou **https://who.is**
2. Entrez votre domaine (ex: `bilibou.com`)
3. Cherchez la ligne **"Registrar"** ou **"Name Server"**
4. Cela vous indiquera où gérer votre domaine

---

## ÉTAPE 4 : Ajouter les enregistrements DNS (Exemples par hébergeur)

### 🟦 Option A : Cloudflare (Le plus courant avec Vercel)

#### 4.1 Se connecter
1. Allez sur **https://dash.cloudflare.com**
2. Connectez-vous
3. Cliquez sur votre domaine dans la liste

#### 4.2 Accéder aux DNS
1. Dans le menu de gauche, cliquez sur **"DNS"**
2. Vous verrez une section **"Records"**

#### 4.3 Ajouter chaque enregistrement

**Enregistrement 1 : TXT pour la vérification**
1. Cliquez sur **"Add record"**
2. **Type** : Sélectionnez `TXT`
3. **Name** : 
   - Si Resend dit `@` → mettez `@` ou le nom de votre domaine nu (ex: `bilibou.com`)
   - Si Resend dit `resend` → mettez `resend`
4. **Content** : Copiez-collez la valeur TXT complète de Resend
   - Exemple : `resend-verification:abc123def456ghi789`
5. **Proxy status** : Laissez sur **"DNS only"** (nuage gris)
6. Cliquez **"Save"**

**Enregistrement 2 : CNAME pour DKIM**
1. Cliquez sur **"Add record"**
2. **Type** : Sélectionnez `CNAME`
3. **Name** : Copiez le "Name" de Resend
   - Exemple : `resend._domainkey`
4. **Target** : Copiez la "Value" de Resend
   - Exemple : `resend._domainkey.resend.com`
5. **Proxy status** : Laissez sur **"DNS only"** (nuage gris)
6. Cliquez **"Save"**

**Répétez pour tous les enregistrements** que Resend vous a donnés !

---

### 🟦 Option B : OVH

#### 4.1 Se connecter
1. Allez sur **https://www.ovh.com/manager**
2. Connectez-vous
3. Cliquez sur **"Zones DNS"** dans le menu

#### 4.2 Accéder à votre zone
1. Cliquez sur votre domaine dans la liste
2. Vous verrez tous vos enregistrements DNS actuels

#### 4.3 Ajouter les enregistrements
1. Cliquez sur **"Ajouter une entrée"** (en haut)
2. Pour chaque type d'enregistrement de Resend :

   **Pour TXT :**
   - **Sous-domaine** : Laissez vide ou mettez selon Resend
   - **Type** : `TXT`
   - **Valeur** : Collez la valeur complète de Resend
   - Cliquez **"Suivant"** puis **"Valider"**

   **Pour CNAME :**
   - **Sous-domaine** : Copiez le "Name" de Resend
   - **Type** : `CNAME`
   - **Cible** : Copiez la "Value" de Resend
   - Cliquez **"Suivant"** puis **"Valider"**

---

### 🟦 Option C : Namecheap

#### 4.1 Se connecter
1. Allez sur **https://www.namecheap.com**
2. Connectez-vous
3. Allez dans **"Domain List"**

#### 4.2 Accéder aux DNS
1. Cliquez sur **"Manage"** à côté de votre domaine
2. Allez dans l'onglet **"Advanced DNS"**

#### 4.3 Ajouter les enregistrements
1. Dans la section **"Host Records"**, cliquez sur **"Add New Record"**

**Pour TXT :**
- **Type** : `TXT Record`
- **Host** : Laissez `@` ou mettez selon Resend
- **Value** : Collez la valeur de Resend
- **TTL** : `Automatic` ou `1 hour`
- Cliquez sur l'icône **✓** pour sauvegarder

**Pour CNAME :**
- **Type** : `CNAME Record`
- **Host** : Le "Name" de Resend (ex: `resend._domainkey`)
- **Value** : La "Value" de Resend (ex: `resend._domainkey.resend.com`)
- **TTL** : `Automatic`
- Cliquez sur l'icône **✓** pour sauvegarder

---

### 🟦 Option D : Google Domains / Squarespace Domains

#### 4.1 Se connecter
1. Allez sur **https://domains.google.com** ou votre panel
2. Connectez-vous

#### 4.2 Accéder aux DNS
1. Cliquez sur votre domaine
2. Allez dans **"DNS"** ou **"Custom records"**

#### 4.3 Ajouter les enregistrements
Suivez la même logique que pour les autres hébergeurs :
- Ajoutez chaque enregistrement TXT, CNAME, etc. que Resend vous a donnés

---

## ÉTAPE 5 : Attendre la propagation DNS

### 5.1 Temps d'attente
- ⏱️ **Temps normal** : 5-30 minutes
- ⏱️ **Temps maximum** : Jusqu'à 48 heures (rare)

### 5.2 Ce qui se passe
Les serveurs DNS dans le monde mettent à jour leurs informations. C'est automatique, vous n'avez rien à faire.

---

## ÉTAPE 6 : Vérifier dans Resend

### 6.1 Actualiser la page Resend
1. Retournez sur **Resend.com** → **"Domains"**
2. Cliquez sur votre domaine dans la liste
3. Cliquez sur **"Verify"** ou **"Check Status"**
4. Resend vérifie si les enregistrements DNS sont corrects

### 6.2 Statuts possibles

✅ **"Verified"** (Vérifié) :
- Tout est bon ! Votre domaine est prêt à l'emploi
- Vous pouvez utiliser `noreply@votre-domaine.com`

⚠️ **"Pending"** (En attente) :
- Les DNS ne sont pas encore propagés
- Attendez encore un peu et réessayez plus tard

❌ **"Failed"** (Échec) :
- Il y a une erreur dans les enregistrements
- Vérifiez que vous avez bien copié-collé toutes les valeurs
- Assurez-vous qu'il n'y a pas d'espaces avant/après

---

## ÉTAPE 7 : Utiliser votre domaine dans Vercel

### 7.1 Une fois vérifié
1. Allez dans **Vercel** → **Settings** → **Environment Variables**
2. Modifiez la variable **`EXPORTS_FROM_EMAIL`** :
   - Ancienne valeur : `onboarding@resend.dev`
   - Nouvelle valeur : `noreply@votre-domaine.com` (remplacez par votre domaine)
3. Ajoutez/modifiez **`INVITES_FROM_EMAIL`** avec la même valeur
4. **Sauvegardez**

### 7.2 Redéployer
1. Dans Vercel → **Deployments**
2. Cliquez sur les 3 points (...) → **"Redeploy"**

---

## 🔍 Vérifier que les DNS sont bien configurés (Outils)

### Option 1 : Vérification en ligne
1. Allez sur **https://mxtoolbox.com/TXTLookup.aspx**
2. Entrez votre domaine
3. Vérifiez que les enregistrements TXT Resend apparaissent

### Option 2 : Ligne de commande (si vous êtes à l'aise)
```bash
# Vérifier les TXT records
nslookup -type=TXT votre-domaine.com

# Vérifier les CNAME records
nslookup -type=CNAME resend._domainkey.votre-domaine.com
```

---

## ⚠️ Erreurs courantes et solutions

### Erreur : "Domain verification failed"

**Causes possibles :**
1. ❌ Vous n'avez pas ajouté tous les enregistrements
   - ✅ Solution : Vérifiez que vous avez ajouté TOUS les enregistrements que Resend vous a donnés

2. ❌ Il y a une faute de frappe dans les valeurs
   - ✅ Solution : Recopiez soigneusement chaque valeur depuis Resend

3. ❌ Les DNS ne sont pas encore propagés
   - ✅ Solution : Attendez 30 minutes et réessayez

4. ❌ Vous avez mis `www.` dans le domaine
   - ✅ Solution : Le domaine doit être sans `www` dans Resend (mais vous pouvez avoir un record CNAME pour www dans vos DNS)

---

## 📝 Checklist complète

- [ ] J'ai ajouté le domaine dans Resend
- [ ] J'ai noté tous les enregistrements DNS à ajouter
- [ ] Je sais où est hébergé mon domaine (Cloudflare, OVH, etc.)
- [ ] J'ai ajouté TOUS les enregistrements TXT dans mon hébergeur DNS
- [ ] J'ai ajouté TOUS les enregistrements CNAME dans mon hébergeur DNS
- [ ] J'ai attendu au moins 5-10 minutes
- [ ] J'ai cliqué sur "Verify" dans Resend
- [ ] Le statut est "Verified" ✅
- [ ] J'ai mis à jour `EXPORTS_FROM_EMAIL` dans Vercel avec mon domaine
- [ ] J'ai redéployé l'application sur Vercel

---

## 💡 Bon à savoir

- Vous pouvez avoir **plusieurs domaines** vérifiés dans Resend
- Vous pouvez utiliser **n'importe quel préfixe** pour vos emails :
  - `noreply@votre-domaine.com` ✅
  - `contact@votre-domaine.com` ✅
  - `hello@votre-domaine.com` ✅
- Les enregistrements DNS que vous ajoutez ne suppriment pas vos autres enregistrements existants

---

## 🆘 Besoin d'aide ?

Si vous êtes bloqué, dites-moi :
1. Où est hébergé votre domaine ? (Cloudflare, OVH, Namecheap, etc.)
2. À quelle étape vous êtes bloqué ?
3. Quel est le message d'erreur que vous voyez ?

Je vous aiderai étape par étape ! 🚀

