# 🏗️ Nouvelle Architecture - Extraction de Factures

## 📋 Vue d'ensemble

Cette nouvelle architecture est basée sur les spécifications fournies par l'utilisateur et implémente un système complet d'extraction de factures depuis les boîtes mail des clients.

## 🗄️ Structure de la Base de Données

### Tables Principales

1. **`clients`** - Vos utilisateurs finaux
   - `id` (UUID)
   - `user_id` (UUID) - Lien avec auth.users
   - `email`, `name`, `company`
   - `active` (boolean)

2. **`email_configurations`** - Configurations email (IMAP/OAuth)
   - `id` (UUID)
   - `client_id` (UUID)
   - `email_provider` ('gmail', 'outlook', 'imap')
   - Credentials IMAP ou OAuth (cryptés)
   - `is_active`, `last_sync_at`

3. **`invoices_new`** - Factures extraites
   - `id` (UUID)
   - `client_id`, `email_config_id`
   - Métadonnées email (from, subject, date, id)
   - Fichier original (filename, url, type, size)
   - Données extraites (invoice_number, dates, vendor, amounts, currency)
   - `extraction_status` ('pending', 'processing', 'success', 'failed')

4. **`invoice_items`** - Lignes de facturation
   - `id` (UUID)
   - `invoice_id`
   - `description`, `quantity`, `unit_price`, `amount`

5. **`extraction_jobs_new`** - Jobs d'extraction (queue)
   - `id` (UUID)
   - `client_id`, `email_config_id`
   - `status` ('pending', 'processing', 'completed', 'failed')
   - Paramètres de recherche (since, keywords)
   - Résultats (emails_found, invoices_extracted, errors_count)

## 🔧 Services Backend

### 1. `email-extractor.ts` - Extraction IMAP/OAuth
- Connexion sécurisée aux boîtes mail
- Recherche d'emails par mots-clés et dates
- Extraction des pièces jointes (PDF, images)

### 2. `invoice-parser.ts` - Analyse IA (OpenAI GPT-4 Vision)
- Extraction automatique des données structurées
- Support PDF et images
- Parsing de tous les champs (numéro, dates, montants, items)

### 3. `invoice-storage.ts` - Stockage Supabase
- Upload vers Supabase Storage
- Sauvegarde en base de données
- Gestion des items de facturation

## 🌐 API Endpoints

### Extraction
- `POST /api/extraction/start` - Démarrer une extraction
- `GET /api/extraction/status?jobId=xxx` - Statut d'un job

### Factures
- `GET /api/invoices-new?page=1&limit=20&status=success` - Liste des factures
- `GET /api/invoices-new/[id]` - Détails d'une facture

### Configurations Email
- `GET /api/email-configs` - Liste des configurations
- `POST /api/email-configs` - Créer une configuration

## 🎨 Frontend

### Pages Adaptées
- `/dashboard/extraction` - Interface d'extraction
  - Sélection de la configuration email
  - Choix de la date de début
  - Lancement et suivi en temps réel
  - Affichage des résultats

## 📦 Dépendances Ajoutées

```json
{
  "imap": "^0.8.19",
  "mailparser": "^3.6.5",
  "@types/imap": "^0.8.40"
}
```

## 🚀 Migration

### 1. Exécuter le script SQL de migration
```sql
-- Exécuter dans Supabase SQL Editor
\i supabase/migrations/20250124_nouvelle_architecture.sql
```

### 2. Migrer les données existantes
```sql
-- Exécuter dans Supabase SQL Editor
\i scripts/migrate-to-new-architecture.sql
```

### 3. Installer les dépendances
```bash
npm install
```

### 4. Redémarrer le serveur
```bash
npm run dev
```

## 🔐 Sécurité

### À Implémenter
- [ ] Cryptage des credentials IMAP/OAuth (bcrypt ou AWS KMS)
- [ ] Validation des entrées utilisateur
- [ ] Rate limiting sur les endpoints
- [ ] Gestion des tokens OAuth expirés

## 📊 Flux d'Extraction

1. **Utilisateur** lance l'extraction depuis le dashboard
2. **API** crée un job d'extraction en base de données
3. **Worker** (en arrière-plan) :
   - Se connecte à la boîte mail via IMAP/OAuth
   - Recherche les emails avec pièces jointes
   - Extrait les fichiers PDF/images
   - Upload vers Supabase Storage
   - Analyse avec OpenAI GPT-4 Vision
   - Sauvegarde les données en base
4. **Frontend** poll le statut du job toutes les 2 secondes
5. **Résultat** affiché à l'utilisateur

## 🎯 Prochaines Étapes

1. ✅ Créer la structure de base de données
2. ✅ Créer les services backend
3. ✅ Créer les endpoints API
4. ✅ Adapter le frontend
5. ⏳ Implémenter le cryptage des credentials
6. ⏳ Ajouter le support OAuth complet (Gmail/Outlook)
7. ⏳ Créer un système de queue avec Bull/Redis
8. ⏳ Ajouter un cron job pour les extractions automatiques
9. ⏳ Implémenter la gestion des erreurs et retry
10. ⏳ Ajouter des tests unitaires

## 📝 Notes Importantes

- **RLS activé** sur toutes les tables pour la sécurité
- **Indexes créés** pour optimiser les performances
- **Triggers** pour mettre à jour `updated_at` automatiquement
- **Vue `client_statistics`** pour les statistiques
- **Politique de suppression en cascade** pour maintenir l'intégrité

## 🆘 Support

En cas de problème :
1. Vérifier les logs du serveur
2. Vérifier les logs Supabase
3. Vérifier que les variables d'environnement sont définies :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`



