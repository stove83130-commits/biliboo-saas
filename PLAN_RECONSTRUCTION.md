# Plan de Reconstruction du SaaS

## Objectif
Reconstruire le SaaS de zéro en gardant uniquement :
- ✅ Système d'extraction d'emails (fonctionne parfaitement)
- ✅ Design de la page d'accueil
- ✅ Design du dashboard

## Fichiers à CONSERVER

### Système d'extraction
- `app/api/extraction/start/route.ts`
- `app/api/extraction/process/route.ts`
- `app/api/extraction/status/route.ts`
- `app/dashboard/extraction/page.tsx`
- `lib/services/email-extractor.ts`
- `lib/services/invoice-ocr-extractor.ts`
- `lib/services/invoice-detector.ts`
- `lib/services/logo-extractor.ts`
- `lib/services/invoice-storage.ts`
- `lib/services/invoice-filter.ts`
- `lib/services/invoice-parser.ts`
- `lib/services/google-document-ai.ts`
- `lib/services/logo-image-extractor.ts`
- `lib/services/logo-pdf-extractor.ts`
- `lib/services/universal-invoice-detector.ts`
- `lib/openai/client.ts`

### Design (Page d'accueil)
- `app/page.tsx`
- `components/sections/*` (toutes les sections)

### Design (Dashboard)
- `app/dashboard/page.tsx`
- `components/dashboard/dashboard-layout.tsx`
- `components/dashboard/dashboard-sidebar.tsx`
- `components/dashboard/dashboard-header.tsx` (si existe)

### UI Components
- `components/ui/*` (tous les composants UI de base)

### Configuration
- `app/globals.css`
- `tailwind.config.ts`
- `next.config.js`
- `package.json`
- `tsconfig.json`

### Supabase (config simple)
- `lib/supabase/client.ts` (version simple)
- `lib/supabase/server.ts` (version simple)
- `middleware.ts` (version simple)

## Fichiers à SUPPRIMER

### Auth complexe
- `app/auth/*` (tout)
- `app/api/auth/*` (tout)
- `components/auth/*` (sauf si nécessaire)

### Billing
- `app/api/billing/*` (tout)
- `app/dashboard/billing/*` (tout)
- `components/billing/*` (tout)
- `lib/billing/*` (tout)
- `contexts/plan-context.tsx`

### Workspaces
- `app/api/workspaces/*` (tout)
- `app/workspaces/*` (tout)
- `components/dashboard/workspace-*` (tout)
- `lib/workspaces/*` (tout)

### Connections/Email configs
- `app/api/connections/*` (tout)
- `app/api/email-accounts/*` (tout)
- `app/api/email-configs/*` (tout)
- `app/api/gmail/*` (tout)
- `app/api/outlook/*` (tout)

### Hooks/Permissions
- `hooks/use-plan-permissions.ts`
- `hooks/use-workspace-permissions.ts`

### Admin
- `app/admin/*` (tout)
- `app/api/admin/*` (tout)
- `app/dashboard/admin/*` (tout)

### Settings complexes
- `app/settings/*` (tout)
- `app/dashboard/settings/*` (simplifier)

### Autres API routes
- `app/api/invoices/*` (à recréer simple)
- `app/api/exports/*` (à recréer simple)
- `app/api/feedback/*`
- `app/api/contact/*`
- `app/api/demo/*`
- `app/api/health/*`
- `app/api/jobs/*`
- `app/api/usage/*`
- `app/api/user/*`

### Pages inutiles
- `app/onboarding/*`
- `app/invite/*`
- `app/verify-email/*`
- `app/plans/*` (garder pricing section dans page d'accueil)
- `app/contact/*` (garder dans page d'accueil)
- `app/cgu/*`, `app/cgv/*`, `app/mentions-legales/*`, `app/politique-confidentialite/*` (garder si nécessaire)

## Structure à RECONSTRUIRE

### 1. Auth simple
- Login/Signup basique avec Supabase
- Pas de vérification email complexe
- Pas de reset password complexe
- Middleware simple pour protéger les routes

### 2. Dashboard simple
- Page principale avec stats
- Page extraction (déjà existante)
- Page factures (liste simple)
- Page exports (simple)

### 3. API routes minimales
- `/api/extraction/*` (déjà existant)
- `/api/invoices` (GET liste, GET détail)
- `/api/exports` (GET liste, POST export)

### 4. Base de données
- Garder les tables existantes :
  - `email_accounts`
  - `extraction_jobs`
  - `invoices`
- Supprimer les tables liées à :
  - Workspaces
  - Billing/Plans
  - Organizations

## Étapes d'exécution

1. ✅ Identifier les fichiers à garder
2. ⏳ Supprimer les fichiers inutiles
3. ⏳ Reconstruire l'auth simple
4. ⏳ Simplifier le dashboard
5. ⏳ Intégrer l'extraction dans la nouvelle structure
6. ⏳ Tester le tout

