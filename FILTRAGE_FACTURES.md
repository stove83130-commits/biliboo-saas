# 🔍 Système de Filtrage des Factures

Ce document explique comment le système détecte et filtre les factures pour éviter les faux positifs.

---

## 📊 Architecture : 4 Niveaux de Filtres

### **FILTRE 1 : Nom du fichier PDF** ❌ Exclusion rapide
**Fichier** : `app/api/extraction/start/route.ts` (lignes 200-217)

**Objectif** : Exclure immédiatement les PDF qui ne sont clairement pas des factures.

**Patterns exclus** :
- `condition`, `cgu`, `cgv`, `terms`, `tcu`, `policy`, `politique`
- `contrat`, `contract`, `agreement`, `accord`, `legal`, `privacy`
- `confidentialit`, `rgpd`, `gdpr`, `mention`, `statut`

**Exemple** :
- ✅ `Facture_Stripe_2025.pdf` → Accepté
- ❌ `Conditions_Generales_Vente.pdf` → Rejeté
- ❌ `Contrat_Prestation.pdf` → Rejeté

---

### **FILTRE 2A : Classification GPT-4o** 🤖 Intelligence artificielle
**Fichier** : `app/api/extraction/start/route.ts` (lignes 307-314)

**Objectif** : GPT-4o analyse le contenu du PDF et détermine son type.

**Types de documents détectés** :
- ✅ `invoice` : Facture commerciale (accepté)
- ✅ `receipt` : Reçu/ticket de caisse (accepté)
- ❌ `terms_and_conditions` : CGV, CGU, mentions légales (rejeté)
- ❌ `pricing_sheet` : Grille tarifaire, barème de prix (rejeté)
- ❌ `notification` : Notification, alerte (rejeté)
- ❌ `contract` : Contrat, accord commercial (rejeté)
- ❌ `other` : Autre type de document (rejeté)

**Exemple avec Revolut** :
```
📄 PDF : Frais_personnels_ultra.pdf
🤖 GPT-4o analyse → "pricing_sheet" (grille tarifaire)
🚫 Document rejeté (type: pricing_sheet)
   → Ce n'est pas une facture/reçu, c'est : pricing_sheet
```

---

### **FILTRE 2B : Données minimales** 📋 Validation de contenu
**Fichier** : `app/api/extraction/start/route.ts` (lignes 316-320)

**Objectif** : Vérifier que le document contient au minimum un numéro de facture OU un montant.

**Règle** :
```typescript
if (!invoice_number && !total_amount) {
  → Rejeté
}
```

**Exemple** :
- ✅ Facture avec numéro `INV-2025-001` et montant `150€` → Accepté
- ✅ Reçu sans numéro mais avec montant `25€` → Accepté
- ❌ Document sans numéro ni montant → Rejeté

---

### **FILTRE 3 : Expéditeur de confiance** 🔐 Validation de l'expéditeur
**Fichier** : `app/api/extraction/start/route.ts` (lignes 229-244)

**Objectif** : Pour les emails **sans PDF**, vérifier que l'expéditeur est de confiance.

**Domaines de confiance** :
- `stripe.com`, `paypal.com`, `square.com`
- `invoice`, `billing`, `noreply`, `no-reply`, `notifications`, `receipts`

**Domaines personnels exclus** :
- `@gmail.com`, `@outlook.com`, `@hotmail.com`, `@yahoo.com`, `@icloud.com`

**Règle** :
```typescript
// Email sans PDF = accepté UNIQUEMENT si :
hasInvoiceKeywordInSubject && isTrustedSender && !isPersonalEmail
```

---

## 🎯 Cas d'Usage : Revolut "Frais personnels"

### **Email reçu** :
- **Expéditeur** : `no-reply@revolut.com`
- **Sujet** : "Modifications de vos frais et conditions pour particuliers 📣"
- **PDF attaché** : `Frais_personnels_ultra.pdf`

### **Traitement par les filtres** :

1. **FILTRE 1 : Nom du fichier**
   - Nom : `Frais_personnels_ultra.pdf`
   - Ne contient pas "condition", "cgu", "terms", etc.
   - ✅ **Accepté** (passe au filtre suivant)

2. **FILTRE 2A : Classification GPT-4o** ⭐ **NOUVEAU !**
   - GPT-4o analyse le contenu du PDF
   - Détecte : "Grille tarifaire avec nouveaux frais bancaires"
   - Classification : `pricing_sheet`
   - 🚫 **REJETÉ** : Ce n'est pas une facture, c'est une grille tarifaire !

3. **Résultat final** :
   ```
   🚫 Document rejeté (type: pricing_sheet) : Frais_personnels_ultra.pdf
      → Ce n'est pas une facture/reçu, c'est : pricing_sheet
   ```

---

## 📈 Avantages de la Solution 3 (Classification GPT-4o)

### ✅ **Précision maximale**
- GPT-4o comprend le **contexte** et le **contenu** du document
- Distingue une facture d'une grille tarifaire, même si les deux contiennent des montants

### ✅ **Pas de faux négatifs**
- Une vraie facture avec "Frais de livraison" dans le nom sera acceptée
- Contrairement à un filtre par mot-clé qui bloquerait "frais"

### ✅ **Évolutif**
- GPT-4o s'adapte automatiquement aux nouveaux types de documents
- Pas besoin de maintenir une liste de mots-clés

### ✅ **Transparent**
- Les logs indiquent clairement pourquoi un document est rejeté
- Exemple : `type: pricing_sheet` au lieu de "pas de numéro ni montant"

---

## 🧪 Tests Recommandés

### **Test 1 : Vraie facture**
- **PDF** : `Facture_Stripe_Janvier_2025.pdf`
- **Attendu** : `document_type = "invoice"` → ✅ Accepté

### **Test 2 : Reçu de caisse**
- **PDF** : `Ticket_Carrefour_20250125.pdf`
- **Attendu** : `document_type = "receipt"` → ✅ Accepté

### **Test 3 : Grille tarifaire**
- **PDF** : `Frais_personnels_ultra.pdf` (Revolut)
- **Attendu** : `document_type = "pricing_sheet"` → 🚫 Rejeté

### **Test 4 : CGV**
- **PDF** : `Conditions_Generales_Vente.pdf`
- **Attendu** : Rejeté par FILTRE 1 (nom de fichier)

### **Test 5 : Notification**
- **PDF** : `Changement_Service_Revolut.pdf`
- **Attendu** : `document_type = "notification"` → 🚫 Rejeté

---

## 🔧 Maintenance

### **Ajouter un nouveau type de document**
Modifier `lib/services/invoice-ocr-extractor.ts` :
```typescript
document_type: 'invoice' | 'receipt' | 'terms_and_conditions' | 'pricing_sheet' | 'notification' | 'contract' | 'NEW_TYPE' | 'other'
```

### **Accepter un nouveau type de document**
Modifier `app/api/extraction/start/route.ts` (ligne 308) :
```typescript
if (fullExtraction.document_type && 
    fullExtraction.document_type !== 'invoice' && 
    fullExtraction.document_type !== 'receipt' &&
    fullExtraction.document_type !== 'NEW_TYPE') {  // ← Ajouter ici
  // Rejeter
}
```

---

## 📊 Statistiques de Filtrage

Après chaque extraction, consultez les logs pour voir :
- Nombre de documents analysés
- Nombre de documents rejetés par type
- Taux de précision du filtrage

**Exemple de logs** :
```
📧 133 emails récupérés
🚫 Document rejeté (type: pricing_sheet) : Frais_personnels_ultra.pdf
🚫 Document rejeté (type: terms_and_conditions) : CGV_Fournisseur.pdf
✅ 5 factures détectées
✅ 5 factures sauvegardées avec succès
```

---

**Date de mise à jour** : 25 octobre 2025  
**Version** : 2.0 (avec classification GPT-4o)

