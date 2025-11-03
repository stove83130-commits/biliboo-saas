# Guide de Test - Synchronisation Automatique des Abonnements

## 🧪 Tests à Effectuer

### Test 1 : Test Complet en Production (Recommandé)

#### Étape 1 : Préparation
1. Connectez-vous à votre compte admin dans Stripe Dashboard
2. Allez dans **Developers** > **Webhooks**
3. Vérifiez que votre webhook est configuré et pointe vers :
   ```
   https://votre-domaine.com/api/billing/webhook
   ```
4. Vérifiez que les événements suivants sont activés :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`

#### Étape 2 : Test avec un Nouveau Compte
1. Créez un **nouveau compte utilisateur** (email différent)
2. Connectez-vous avec ce compte
3. Allez sur la page `/plans`
4. Cliquez sur **"S'abonner"** pour le plan **Pro mensuel**
5. Utilisez une **carte de test Stripe** :
   ```
   Numéro : 4242 4242 4242 4242
   Date : n'importe quelle date future (ex: 12/25)
   CVC : n'importe quel 3 chiffres (ex: 123)
   ```
6. Complétez le paiement

#### Étape 3 : Vérification Immédiate
Après le paiement, vous serez redirigé vers `/dashboard?success=true&payment=success&sync=true`

**Vérifiez dans la console du navigateur** (F12 > Console) :
- ✅ Vous devriez voir : `✅ Synchronisation automatique réussie après paiement`
- ✅ La page devrait se recharger automatiquement après 2-3 secondes

#### Étape 4 : Vérification des Métadonnées
1. Allez dans l'onglet **"Facturation"** (`/settings/billing`)
2. Vérifiez que :
   - ✅ Le plan **Pro** s'affiche
   - ✅ Le statut est **"Actif"**
   - ✅ La date de prochaine facturation est affichée

#### Étape 5 : Vérification dans Stripe
1. Dans Stripe Dashboard > **Customers**
2. Trouvez le customer avec l'email de test
3. Vérifiez dans **Metadata** :
   - ✅ `supabase_user_id` doit être présent
4. Dans **Subscriptions**, vérifiez :
   - ✅ L'abonnement est créé
   - ✅ Le statut est **active** ou **trialing**

---

### Test 2 : Vérifier le Webhook

#### Option A : Via Stripe Dashboard
1. Allez dans **Developers** > **Webhooks**
2. Cliquez sur votre webhook
3. Allez dans l'onglet **"Events"**
4. Recherchez les événements récents :
   - `checkout.session.completed` (doit être ✅ vert)
   - `customer.subscription.updated` (doit être ✅ vert)
5. Cliquez sur un événement pour voir les détails
6. Vérifiez la réponse : doit être `200 OK`

#### Option B : Via les Logs Serveur
Si vous avez accès aux logs de production, vérifiez :
```
✅ Plan attribué via checkout: pro pour utilisateur: [user_id]
✅ Subscription updated via webhook: [subscription_id] Plan: pro
```

---

### Test 3 : Test de Synchronisation Automatique en Arrière-plan

#### Scénario : Simuler un cas où le webhook n'a pas fonctionné
1. Connectez-vous avec un compte qui a un `stripe_customer_id` mais pas de plan
2. Allez sur `/settings/billing`
3. Ouvrez la console (F12)
4. Attendez 30 secondes
5. Vérifiez dans la console :
   ```
   🔄 Vérification périodique: synchronisation automatique déclenchée
   ✅ Synchronisation périodique réussie
   ```
6. La page devrait se mettre à jour automatiquement avec le plan

---

### Test 4 : Test Local avec Stripe CLI (Avancé)

Si vous voulez tester en local avant de déployer :

1. **Installer Stripe CLI** :
   ```bash
   # Sur Windows avec Chocolatey
   choco install stripe
   
   # Ou télécharger depuis https://stripe.com/docs/stripe-cli
   ```

2. **Se connecter à Stripe** :
   ```bash
   stripe login
   ```

3. **Écouter les webhooks en local** :
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
   
   Cela vous donnera un `webhook signing secret` à ajouter dans votre `.env.local` :
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. **Déclencher un événement de test** :
   ```bash
   stripe trigger checkout.session.completed
   ```

5. Vérifiez les logs de votre serveur local

---

## 🔍 Vérifications Finales

### Dans Supabase
1. Allez dans **Authentication** > **Users**
2. Trouvez votre utilisateur de test
3. Cliquez sur **Edit**
4. Dans **User Metadata**, vérifiez :
   ```json
   {
     "selected_plan": "pro",
     "subscription_status": "active",
     "stripe_customer_id": "cus_...",
     "stripe_subscription_id": "sub_...",
     "current_period_end": "2024-..."
   }
   ```

### Dans le Code
Vérifiez les logs console du navigateur :
- ✅ Pas d'erreurs
- ✅ Messages de synchronisation réussie
- ✅ Rechargement automatique de la page

---

## 🐛 Dépannage

### Problème : Le plan ne s'affiche pas après le paiement

**Vérifications :**
1. **Webhook configuré ?**
   - Dashboard Stripe > Webhooks > Votre webhook est-il actif ?

2. **Webhook Secret correct ?**
   - Vérifiez `STRIPE_WEBHOOK_SECRET` dans vos variables d'environnement
   - Le secret doit correspondre à l'environnement (production vs test)

3. **Logs du webhook ?**
   - Vérifiez dans Stripe Dashboard > Webhooks > Events
   - Y a-t-il des erreurs 4xx ou 5xx ?

4. **Customer créé ?**
   - Le customer Stripe doit avoir `supabase_user_id` dans ses métadonnées
   - Vérifiez dans Stripe > Customers

5. **Console navigateur ?**
   - Ouvrez F12 > Console
   - Y a-t-il des erreurs JavaScript ?
   - Vérifiez les requêtes réseau (onglet Network)

### Problème : Synchronisation périodique ne fonctionne pas

**Vérifications :**
1. Le compte a-t-il un `stripe_customer_id` ?
2. La page `/settings/billing` est-elle ouverte ?
3. Y a-t-il des erreurs dans la console ?

---

## ✅ Checklist de Validation

Après chaque test, cochez :

- [ ] Le paiement se complète avec succès
- [ ] Le webhook reçoit l'événement `checkout.session.completed`
- [ ] Le webhook met à jour les métadonnées utilisateur dans Supabase
- [ ] La synchronisation automatique se déclenche après le retour du paiement
- [ ] Le plan s'affiche correctement dans `/settings/billing`
- [ ] Le statut est "Actif"
- [ ] La date de prochaine facturation est affichée
- [ ] Le customer Stripe a les bonnes métadonnées
- [ ] La synchronisation périodique fonctionne en arrière-plan

---

## 📝 Notes Importantes

1. **Cartes de test Stripe** :
   - Pour tester un paiement réussi : `4242 4242 4242 4242`
   - Pour tester un échec : `4000 0000 0000 0002`
   - Pour tester un 3D Secure : `4000 0027 6000 3184`

2. **Environnement de test vs Production** :
   - Assurez-vous d'utiliser les bonnes clés API Stripe
   - Les webhooks doivent pointer vers le bon environnement
   - Vérifiez que `NEXT_PUBLIC_APP_URL` est correct

3. **Délais** :
   - Le webhook Stripe peut prendre 1-2 secondes
   - La synchronisation automatique attend 2 secondes avant de s'exécuter
   - Si nécessaire, elle réessaie après 3 secondes supplémentaires

---

## 🚀 Test Rapide (1 minute)

Pour un test rapide :

1. Créez un compte de test
2. Abonnez-vous au plan Pro mensuel avec la carte `4242 4242 4242 4242`
3. Attendez 5 secondes après le retour sur le dashboard
4. Allez dans `/settings/billing`
5. Vérifiez que le plan Pro s'affiche

Si ça marche, c'est bon ! ✅
