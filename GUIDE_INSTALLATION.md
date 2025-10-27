# 📘 Guide d'Installation - Nouvelle Architecture

## ✅ Étape 1 : Installer les Dépendances

Les dépendances ont déjà été installées automatiquement. Si besoin, relancez :

```bash
npm install
```

## ✅ Étape 2 : Configurer Supabase

### 2.1 Créer les Tables

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Copiez-collez le contenu de `supabase/migrations/20250124_nouvelle_architecture.sql`
5. Cliquez sur **Run**

### 2.2 Créer le Bucket Storage

1. Dans le **SQL Editor**, exécutez le script `scripts/create-storage-bucket.sql`
2. Ou allez dans **Storage** > **Create a new bucket**
   - Nom: `invoices`
   - Public: ✅ Oui
   - Cliquez sur **Create bucket**

### 2.3 Migrer les Données Existantes (Optionnel)

Si vous avez déjà des données dans l'ancien système :

1. Dans le **SQL Editor**, exécutez `scripts/migrate-to-new-architecture.sql`
2. Vérifiez que les données ont été migrées :
   ```sql
   SELECT * FROM clients;
   SELECT * FROM email_configurations;
   ```

## ✅ Étape 3 : Configurer les Variables d'Environnement

Vérifiez que votre fichier `.env.local` contient :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# OpenAI (pour l'analyse IA)
OPENAI_API_KEY=sk-...

# Test (optionnel)
TEST_EMAIL=votre-email@gmail.com
TEST_PASSWORD=votre-app-password
```

## ✅ Étape 4 : Démarrer le Serveur

```bash
npm run dev
```

Le serveur démarrera sur `http://localhost:3001`

## ✅ Étape 5 : Tester l'Installation

### 5.1 Test Manuel

1. Allez sur `http://localhost:3001/dashboard/extraction`
2. Vous devriez voir la nouvelle interface d'extraction
3. Si vous n'avez pas encore de configuration email, créez-en une

### 5.2 Test Automatique (Optionnel)

```bash
npx tsx scripts/test-nouvelle-architecture.ts
```

## 🔧 Configuration d'une Connexion Email

### Option 1 : Gmail avec App Password

1. Allez sur [Google Account Security](https://myaccount.google.com/security)
2. Activez la **vérification en 2 étapes**
3. Créez un **mot de passe d'application** :
   - Allez dans **Sécurité** > **Vérification en 2 étapes** > **Mots de passe des applications**
   - Sélectionnez **Autre** et donnez un nom (ex: "Extraction Factures")
   - Copiez le mot de passe généré (16 caractères)

4. Dans votre dashboard, créez une configuration email :
   - Provider: `gmail`
   - Email: `votre-email@gmail.com`
   - Host: `imap.gmail.com`
   - Port: `993`
   - Password: Le mot de passe d'application

### Option 2 : Outlook/Microsoft 365

1. Allez sur [Microsoft Account Security](https://account.microsoft.com/security)
2. Activez la **vérification en 2 étapes**
3. Créez un **mot de passe d'application**

4. Dans votre dashboard :
   - Provider: `outlook`
   - Email: `votre-email@outlook.com`
   - Host: `outlook.office365.com`
   - Port: `993`
   - Password: Le mot de passe d'application

### Option 3 : Autre (IMAP Générique)

Consultez la documentation de votre fournisseur email pour obtenir :
- L'adresse du serveur IMAP
- Le port (généralement 993 pour IMAP SSL)
- Vos identifiants

## 🚀 Utilisation

### Extraire des Factures

1. Allez sur `/dashboard/extraction`
2. Sélectionnez votre configuration email
3. Choisissez la date de début (par défaut : 90 derniers jours)
4. Cliquez sur **Lancer l'extraction**
5. Suivez le progrès en temps réel
6. Une fois terminé, cliquez sur **Voir mes factures**

### Voir les Factures

1. Allez sur `/dashboard/invoices`
2. Vous verrez toutes vos factures extraites
3. Cliquez sur une facture pour voir les détails
4. Les données sont automatiquement extraites par IA (GPT-4 Vision)

## 🔐 Sécurité

### ⚠️ IMPORTANT : Cryptage des Credentials

**À FAIRE AVANT LA PRODUCTION** :

Les mots de passe IMAP sont actuellement stockés en clair dans la base de données. Vous devez implémenter le cryptage :

1. Installer `bcrypt` ou utiliser AWS KMS
2. Modifier `lib/services/email-extractor.ts` pour décrypter les credentials
3. Modifier `app/api/email-configs/route.ts` pour crypter avant sauvegarde

Exemple avec bcrypt :
```typescript
import bcrypt from 'bcrypt';

// Crypter
const hashedPassword = await bcrypt.hash(password, 10);

// Décrypter (vérifier)
const isValid = await bcrypt.compare(password, hashedPassword);
```

## 📊 Vérification

### Vérifier les Tables

```sql
-- Compter les clients
SELECT COUNT(*) FROM clients;

-- Compter les configurations email
SELECT COUNT(*) FROM email_configurations;

-- Compter les factures
SELECT COUNT(*) FROM invoices_new;

-- Voir les statistiques
SELECT * FROM client_statistics;
```

### Vérifier le Bucket Storage

1. Allez dans **Storage** > **invoices**
2. Vous devriez voir les fichiers uploadés après une extraction

## 🆘 Dépannage

### Erreur : "Table does not exist"

➡️ Exécutez le script SQL de migration (Étape 2.1)

### Erreur : "Bucket does not exist"

➡️ Créez le bucket storage (Étape 2.2)

### Erreur : "OPENAI_API_KEY not defined"

➡️ Ajoutez votre clé OpenAI dans `.env.local`

### Erreur : "IMAP connection failed"

➡️ Vérifiez :
- Que vous utilisez un **mot de passe d'application** (pas votre mot de passe principal)
- Que la **vérification en 2 étapes** est activée
- Que l'accès IMAP est autorisé dans les paramètres de votre compte

### Erreur : "RLS policy violation"

➡️ Les policies RLS sont activées. Assurez-vous d'être connecté avec le bon utilisateur.

## 📝 Prochaines Étapes

1. ✅ Tester l'extraction avec votre propre boîte mail
2. ✅ Vérifier que les factures sont correctement extraites
3. ✅ Vérifier que l'analyse IA fonctionne
4. ⏳ Implémenter le cryptage des credentials
5. ⏳ Configurer un cron job pour les extractions automatiques
6. ⏳ Ajouter le support OAuth complet (Gmail/Outlook)

## 🎉 Félicitations !

Votre nouvelle architecture est maintenant opérationnelle ! 🚀

Pour toute question, consultez `NOUVELLE_ARCHITECTURE.md` pour plus de détails techniques.



