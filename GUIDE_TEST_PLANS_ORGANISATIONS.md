# Guide de Test - Plans & Organisations

Ce guide vous permet de tester systématiquement que toutes les restrictions, permissions et limites des plans fonctionnent correctement.

## 📍 Page de Diagnostic

Accédez à `/dashboard/diagnostic` pour voir en temps réel :
- Votre plan actuel et ses limites
- Les compteurs actuels (emails, organisations, factures)
- Les permissions (ce qui est autorisé/interdit)
- Les tests de validation automatiques

## 🧪 Scénarios de Test

### 1. Test Plan Starter

**Limites attendues :**
- ✅ 1 compte e-mail maximum
- ❌ 0 organisation (non autorisé)
- ❌ Export automatique non disponible
- ✅ 100 factures/mois incluses

**Tests à effectuer :**

1. **Ajout de compte e-mail**
   - [ ] Ajouter 1 compte e-mail → ✅ Doit fonctionner
   - [ ] Essayer d'ajouter un 2ème compte → ❌ Doit être bloqué avec message d'erreur

2. **Création d'organisation**
   - [ ] Essayer de créer une organisation → ❌ Doit être bloqué avec message "Votre plan ne permet pas de créer des organisations"

3. **Export automatique**
   - [ ] Vérifier que l'option d'export automatique n'apparaît pas dans les paramètres

4. **Limite de factures**
   - [ ] Créer 100 factures → ✅ Doit fonctionner
   - [ ] Créer une 101ème facture → ⚠️ Doit afficher un avertissement (ou facturer 0,15€)

### 2. Test Plan Pro

**Limites attendues :**
- ✅ 3 comptes e-mail maximum
- ✅ 1 organisation maximum
- ✅ Export automatique disponible
- ✅ 300 factures/mois incluses

**Tests à effectuer :**

1. **Ajout de comptes e-mail**
   - [ ] Ajouter 3 comptes e-mail → ✅ Doit fonctionner
   - [ ] Essayer d'ajouter un 4ème compte → ❌ Doit être bloqué

2. **Création d'organisations**
   - [ ] Créer 1 organisation → ✅ Doit fonctionner
   - [ ] Essayer de créer une 2ème organisation → ❌ Doit être bloqué avec message "Limite atteinte"

3. **Export automatique**
   - [ ] Vérifier que l'option d'export automatique apparaît dans les paramètres
   - [ ] Configurer un export automatique → ✅ Doit fonctionner

### 3. Test Plan Business

**Limites attendues :**
- ✅ 10 comptes e-mail maximum
- ✅ Organisations illimitées
- ✅ Export automatique disponible
- ✅ 1200 factures/mois incluses

**Tests à effectuer :**

1. **Ajout de comptes e-mail**
   - [ ] Ajouter 10 comptes e-mail → ✅ Doit fonctionner
   - [ ] Essayer d'ajouter un 11ème compte → ❌ Doit être bloqué

2. **Création d'organisations**
   - [ ] Créer plusieurs organisations → ✅ Doit fonctionner (illimité)
   - [ ] Vérifier qu'il n'y a pas de limite

### 4. Test Plan Enterprise

**Limites attendues :**
- ✅ Comptes e-mail illimités
- ✅ Organisations illimitées
- ✅ Export automatique disponible
- ✅ Factures illimitées

**Tests à effectuer :**

1. **Toutes les limites doivent être illimitées**
   - [ ] Ajouter plusieurs comptes e-mail → ✅ Doit toujours fonctionner
   - [ ] Créer plusieurs organisations → ✅ Doit toujours fonctionner
   - [ ] Créer beaucoup de factures → ✅ Doit toujours fonctionner

## 🔍 Points de Vérification par Fonctionnalité

### Comptes E-mail (`/api/gmail/connect`)

**Où vérifier :**
- `app/api/gmail/connect/route.ts` ligne 65
- Utilise `canAddEmailAccount(planId, count)`

**Test manuel :**
1. Aller sur `/dashboard/settings`
2. Section "Comptes e-mail"
3. Cliquer sur "Connecter un compte"
4. Vérifier le comportement selon le plan

### Organisations (`/api/workspaces`)

**Où vérifier :**
- `app/api/workspaces/route.ts` ligne 101
- Utilise `canCreateOrganization(planId, orgCount)`

**Test manuel :**
1. Aller sur `/dashboard/settings/organization/new`
2. Essayer de créer une organisation
3. Vérifier le message d'erreur si limite atteinte

### Export Automatique

**Où vérifier :**
- `hooks/use-plan-permissions.ts`
- Utilise `canUseAutoExport(planId)`

**Test manuel :**
1. Aller sur `/dashboard/settings`
2. Section "Export automatique"
3. Vérifier si l'option est disponible selon le plan

### Limite de Factures

**Où vérifier :**
- `lib/billing/plans.ts` - `getMonthlyInvoiceLimit()`
- `lib/billing/plans.ts` - `calculateExtraCost()`

**Test manuel :**
1. Vérifier le compteur dans `/dashboard/diagnostic`
2. Créer des factures jusqu'à la limite
3. Vérifier le comportement au-delà de la limite

## 🐛 Tests de Cas Limites

### Cas 1 : Utilisateur sans plan
- [ ] Vérifier que toutes les fonctionnalités sont bloquées
- [ ] Vérifier les messages d'erreur appropriés

### Cas 2 : Utilisateur avec plan expiré
- [ ] Vérifier que les limites sont toujours appliquées
- [ ] Vérifier les messages d'avertissement

### Cas 3 : Passage d'un plan à un autre
- [ ] Upgrader de Starter à Pro → ✅ Doit débloquer les organisations
- [ ] Downgrader de Pro à Starter → ❌ Doit bloquer les organisations si déjà créées

### Cas 4 : Compteurs incorrects
- [ ] Vérifier que les compteurs dans `/dashboard/diagnostic` correspondent à la réalité
- [ ] Vérifier que les emails inactifs ne sont pas comptés
- [ ] Vérifier que seules les organisations de type 'organization' sont comptées

## 📊 Vérification Automatique

La page `/dashboard/diagnostic` effectue automatiquement :
- ✅ Comptage des emails actifs
- ✅ Comptage des organisations
- ✅ Comptage des factures du mois
- ✅ Vérification des permissions
- ✅ Tests de validation

## 🔧 Commandes Utiles pour le Debug

### Vérifier le plan d'un utilisateur
```sql
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'selected_plan' as plan,
  raw_user_meta_data->>'subscription_status' as status
FROM auth.users
WHERE email = 'votre-email@example.com';
```

### Compter les emails d'un utilisateur
```sql
SELECT COUNT(*) 
FROM email_accounts 
WHERE user_id = 'user-id' AND is_active = true;
```

### Compter les organisations d'un utilisateur
```sql
SELECT COUNT(*) 
FROM workspaces 
WHERE owner_id = 'user-id' AND type = 'organization';
```

### Compter les factures du mois
```sql
SELECT COUNT(*) 
FROM invoices 
WHERE user_id = 'user-id' 
  AND created_at >= date_trunc('month', CURRENT_DATE);
```

## ✅ Checklist de Validation

Avant de considérer que tout fonctionne :

- [ ] Tous les plans (Starter, Pro, Business, Enterprise) ont été testés
- [ ] Les limites de chaque plan sont respectées
- [ ] Les messages d'erreur sont clairs et informatifs
- [ ] Les compteurs sont exacts
- [ ] Les permissions sont correctement appliquées dans l'UI
- [ ] Les permissions sont correctement appliquées dans les API
- [ ] Les cas limites (sans plan, plan expiré) sont gérés
- [ ] Les changements de plan fonctionnent correctement
- [ ] La page de diagnostic affiche les bonnes informations

## 🚨 Problèmes Courants

### Les compteurs sont incorrects
- Vérifier que `is_active = true` pour les emails
- Vérifier que `type = 'organization'` pour les organisations
- Vérifier les dates pour les factures du mois

### Les permissions ne sont pas appliquées
- Vérifier que `user.user_metadata?.selected_plan` est bien défini
- Vérifier que les fonctions dans `lib/billing/plans.ts` sont bien appelées
- Vérifier les logs de la console pour les erreurs

### Les messages d'erreur ne s'affichent pas
- Vérifier que les API retournent les bons codes d'erreur (403)
- Vérifier que l'UI gère correctement les erreurs
- Vérifier les redirections avec les paramètres d'erreur

