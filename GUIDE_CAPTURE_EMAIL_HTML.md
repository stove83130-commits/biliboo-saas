# 📸 Guide : Capture d'image des emails HTML (reçus sans PDF)

## 🎯 Objectif

Pour les reçus/factures qui **n'ont pas de PDF attaché** mais qui contiennent le reçu directement dans le **corps de l'email en HTML** (comme Replit, Apple, Stripe, etc.), le système capture automatiquement une **image du contenu de l'email** pour l'afficher dans les détails de la facture.

---

## 🔧 Fonctionnement technique

### 1️⃣ **Détection**
Lorsqu'un email est détecté comme une facture/reçu mais **sans PDF attaché** :
- Le système vérifie la présence de mots-clés de facture dans le sujet
- L'expéditeur doit être de confiance (domaine professionnel)
- Le contenu HTML de l'email doit être disponible

### 2️⃣ **Capture d'image**
Le système utilise **Puppeteer** (navigateur headless) pour :
1. Charger le HTML de l'email dans un navigateur virtuel
2. Appliquer des styles de base pour un rendu propre
3. Prendre un screenshot de la page entière (fullPage)
4. Générer une image PNG haute qualité (2x deviceScaleFactor)

### 3️⃣ **Stockage**
L'image est uploadée dans **Supabase Storage** :
- **Bucket** : `invoices`
- **Chemin** : `{user_id}/email_{timestamp}_{subject}.png`
- **Type** : `image/png`

### 4️⃣ **Affichage**
L'image est affichée dans le panneau de droite des détails de facture, exactement comme un PDF.

---

## 📂 Fichiers modifiés

### **1. `lib/utils/html-to-image.ts`** (NOUVEAU)
Utilitaire pour convertir le HTML en image avec Puppeteer.

**Fonctions principales :**
- `convertHtmlToImage(html, width)` : Convertit le HTML en Buffer PNG
- `cleanHtmlForScreenshot(html)` : Nettoie le HTML pour un meilleur rendu

**Configuration Puppeteer :**
```typescript
{
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
}
```

### **2. `app/api/extraction/start/route.ts`**
Ajout de la logique de capture d'image pour les emails HTML.

**Modifications :**
- Import de `convertHtmlToImage` et `cleanHtmlForScreenshot`
- Capture d'image après l'analyse GPT-4o du HTML
- Upload de l'image dans Supabase Storage
- Sauvegarde de l'URL dans `original_file_url`
- Sauvegarde du nom dans `original_file_name`
- Sauvegarde du type MIME `image/png` dans `original_mime_type`

---

## 🗄️ Structure de la base de données

Les données sont stockées dans les mêmes colonnes que les PDFs :

| Colonne | Type | Description |
|---------|------|-------------|
| `original_file_url` | TEXT | URL publique de l'image PNG |
| `original_file_name` | TEXT | Nom du fichier (ex: `email_1234567890_Receipt.png`) |
| `original_mime_type` | TEXT | `image/png` pour les emails HTML |

---

## 🎨 Rendu visuel

Le HTML est nettoyé et stylisé pour un rendu optimal :

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  padding: 20px;
  background: white;
  max-width: 800px;
  margin: 0 auto;
}
img {
  max-width: 100%;
  height: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
}
```

---

## 📊 Exemple de flux

### **Email Replit (24 octobre, 4,93$)**

1. **Réception email** : Sujet "Your Replit receipt for October 2024"
2. **Détection** : Pas de PDF, mais mots-clés "receipt" + expéditeur `@replit.com`
3. **Analyse HTML** : GPT-4o extrait les données (montant, date, etc.)
4. **Capture image** : Puppeteer capture le design du reçu
5. **Upload** : Image uploadée dans `invoices/{user_id}/email_1729800000_Your_Replit_receipt.png`
6. **Affichage** : L'image s'affiche dans les détails de la facture

---

## 🚀 Dépendances

### **Puppeteer**
```bash
npm install puppeteer
```

**Pourquoi Puppeteer ?**
- ✅ Rendu HTML fidèle (comme un vrai navigateur)
- ✅ Support complet CSS/JS
- ✅ Screenshots haute qualité
- ✅ Largement utilisé et maintenu

---

## ⚙️ Configuration

### **Variables d'environnement**
Aucune nouvelle variable nécessaire. Utilise les mêmes que pour Supabase Storage.

### **Supabase Storage**
Le bucket `invoices` doit être configuré pour accepter les images PNG :
- Taille max : 10 MB
- Types MIME autorisés : `application/pdf`, `image/png`

---

## 🐛 Gestion des erreurs

Si la capture d'image échoue :
- ❌ L'erreur est loggée dans la console
- ✅ L'extraction continue quand même (données texte sauvegardées)
- ✅ Pas de blocage du processus d'extraction

**Logs :**
```
📸 Capture d'image du contenu de l'email...
✅ Image email uploadée: {user_id}/email_1234567890_Receipt.png
```

ou

```
❌ Erreur capture image email: [error details]
```

---

## 🎯 Cas d'usage

Cette fonctionnalité est particulièrement utile pour :
- **Replit** : Reçus mensuels sans PDF
- **Apple** : Reçus d'achats App Store/iTunes
- **Stripe** : Notifications de paiement
- **PayPal** : Confirmations de transaction
- **Revolut** : Notifications de frais
- **Tout service** qui envoie des reçus en HTML uniquement

---

## 📈 Performance

- **Temps de capture** : ~2-3 secondes par email
- **Taille image** : ~200-500 KB (PNG optimisé)
- **Impact sur l'extraction** : Minime (parallélisé avec l'analyse GPT-4o)

---

## ✅ Résultat final

Maintenant, pour **tous les reçus sans PDF** (comme Replit, Apple, etc.), vous verrez :
- ✅ L'image du reçu dans le panneau de droite
- ✅ Les données extraites dans le panneau de gauche
- ✅ Une expérience utilisateur identique aux factures PDF

**Avant** : Pas d'aperçu visuel pour les emails HTML  
**Après** : Screenshot automatique du contenu de l'email 🎉

