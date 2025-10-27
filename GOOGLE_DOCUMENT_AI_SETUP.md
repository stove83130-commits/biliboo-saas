# 🤖 Configuration Google Document AI

Ce guide explique comment configurer **Google Document AI** pour extraire automatiquement les données des factures PDF.

---

## 📋 **Prérequis**

- ✅ Compte Google Cloud actif
- ✅ Carte bancaire (pour activer l'API, mais 1 000 pages/mois gratuites)

---

## 🚀 **Étapes de Configuration**

### **1️⃣ Activer l'API Document AI**

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet (ou créez-en un nouveau)
3. Dans la barre de recherche, tapez **"Document AI API"**
4. Cliquez sur **"Activer"**

---

### **2️⃣ Créer un Processeur Invoice Parser**

1. Dans Google Cloud Console, allez dans **"Document AI"** → **"Processeurs"**
2. Cliquez sur **"Créer un processeur"**
3. Sélectionnez **"Invoice Parser"** (spécialisé pour les factures)
4. Donnez-lui un nom (ex: `tradia-invoice-extractor`)
5. Choisissez la région **"eu"** (Europe)
6. **Notez l'ID du processeur** (vous en aurez besoin plus tard)
   - Format : `1234567890abcdef`

---

### **3️⃣ Créer un Compte de Service**

1. Allez dans **"IAM & Admin"** → **"Comptes de service"**
2. Cliquez sur **"Créer un compte de service"**
3. Nom : `tradia-invoice-extractor`
4. Description : `Service d'extraction de factures avec Document AI`
5. Cliquez sur **"Créer et continuer"**
6. Rôle : Sélectionnez **"Document AI API User"**
7. Cliquez sur **"Continuer"** puis **"Terminé"**

---

### **4️⃣ Télécharger la Clé JSON**

1. Dans la liste des comptes de service, cliquez sur celui que vous venez de créer
2. Allez dans l'onglet **"Clés"**
3. Cliquez sur **"Ajouter une clé"** → **"Créer une clé"**
4. Format : **JSON**
5. Cliquez sur **"Créer"**
6. Le fichier JSON sera téléchargé automatiquement

---

### **5️⃣ Configurer le Projet**

1. **Placez le fichier JSON téléchargé** à la racine de votre projet :
   ```
   C:\Users\Noa\Desktop\tradia\google-credentials.json
   ```

2. **Ajoutez ces variables dans `.env.local`** :

```bash
# ========================================
# 🤖 GOOGLE DOCUMENT AI
# ========================================

# Chemin vers le fichier JSON des credentials
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# ID de votre projet Google Cloud
GOOGLE_CLOUD_PROJECT_ID=votre-projet-id

# ID du processeur Invoice Parser
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=votre-processor-id

# Région du processeur (eu, us, asia)
GOOGLE_DOCUMENT_AI_LOCATION=eu
```

3. **Remplacez les valeurs** :
   - `votre-projet-id` : ID de votre projet Google Cloud (ex: `tradia-invoice-extractor`)
   - `votre-processor-id` : ID du processeur créé à l'étape 2 (ex: `1234567890abcdef`)

---

## 🧪 **Tester l'Installation**

1. **Redémarrez le serveur** :
   ```bash
   npm run dev
   ```

2. **Lancez une extraction** depuis le dashboard

3. **Vérifiez les logs** dans le terminal :
   ```
   🤖 [Document AI] Extraction de Invoice-XXX.pdf...
   📤 [Document AI] Envoi du PDF à Google Cloud...
   ✅ [Document AI] Document traité avec succès
   ✅ [Document AI] Données extraites :
      - Vendeur: Anthropic, PBC
      - Montant: 123.45 EUR
      - Adresse: 123 Rue Exemple
      - Ville: Paris
      - Pays: France
      ...
   ```

---

## 💰 **Tarification**

### **Offre Gratuite**
- ✅ **1 000 pages/mois GRATUITES** (Invoice Parser)
- ✅ Parfait pour démarrer et tester

### **Après la limite gratuite**
- 💵 **$0.65 par page** (Invoice Parser)
- 📊 Exemple : 2 000 factures/mois = **$650/mois** (après les 1 000 premières gratuites)

### **Comparaison avec OpenAI GPT-4o**
| Service | Coût par facture | Précision | Vitesse |
|---------|------------------|-----------|---------|
| **Google Document AI** | $0.65/page | ⭐⭐⭐⭐⭐ (95-98%) | ⚡⚡⚡ Très rapide |
| **OpenAI GPT-4o** | ~$0.10-0.30 | ⭐⭐⭐⭐ (85-90%) | ⚡⚡ Moyen |

---

## 🎯 **Avantages de Google Document AI**

1. ✅ **Spécialisé pour les factures** (Invoice Parser entraîné sur des millions de factures)
2. ✅ **Extraction structurée automatique** (montants, dates, TVA, fournisseur, etc.)
3. ✅ **Meilleure précision** que GPT-4o pour les données financières
4. ✅ **Pas besoin de prompt engineering** (tout est automatique)
5. ✅ **Support natif des PDF** (pas besoin d'extraire le texte manuellement)
6. ✅ **Multilingue** (français, anglais, espagnol, etc.)

---

## 🔒 **Sécurité**

- ⚠️ **NE JAMAIS commiter le fichier `google-credentials.json` sur Git**
- ✅ Ajoutez-le dans `.gitignore` :
  ```
  google-credentials.json
  ```

---

## 🆘 **Dépannage**

### **Erreur : "GOOGLE_CLOUD_PROJECT_ID manquant"**
- Vérifiez que la variable est bien dans `.env.local`
- Redémarrez le serveur après modification

### **Erreur : "Permission denied"**
- Vérifiez que le compte de service a le rôle **"Document AI API User"**
- Vérifiez que l'API Document AI est bien activée

### **Erreur : "Processor not found"**
- Vérifiez l'ID du processeur dans Google Cloud Console
- Vérifiez que la région correspond (`eu`, `us`, `asia`)

---

## 📚 **Documentation Officielle**

- [Google Document AI](https://cloud.google.com/document-ai/docs)
- [Invoice Parser](https://cloud.google.com/document-ai/docs/processors-list#processor_invoice-processor)
- [Tarification](https://cloud.google.com/document-ai/pricing)

---

**🎉 Vous êtes prêt à extraire des factures avec Google Document AI !**


