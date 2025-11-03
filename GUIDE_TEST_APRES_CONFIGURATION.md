# Guide : Test après configuration Stripe Production

## ✅ Étapes de vérification

### 1. Vérifier que le déploiement est terminé

1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Deployments**
4. Vérifiez que le dernier déploiement est **Ready** (vert) et pas en cours

### 2. Tester la création d'une session de paiement

1. Allez sur votre site en production
2. Essayez de prendre un abonnement (n'importe quel plan)
3. **Résultats possibles :**
   - ✅ **Redirection vers Stripe** → Tout fonctionne !
   - ❌ **Message d'erreur** → Notez le message exact pour diagnostiquer

### 3. Vérifier les logs en cas d'erreur

Si vous avez une erreur :

#### Dans la console du navigateur (F12)
1. Ouvrez les **Developer Tools** (F12)
2. Allez dans l'onglet **Console**
3. Essayez de créer une session de paiement
4. Regardez les messages d'erreur (ils devraient être détaillés maintenant)

#### Dans Vercel Logs
1. Vercel Dashboard → Votre projet → **Functions**
2. Cliquez sur **Logs**
3. Filtrez par `/api/billing/checkout`
4. Regardez les logs récents lors de votre tentative

## 🎯 Test complet recommandé

### Étape 1 : Test basique
- [ ] Aller sur votre site en production
- [ ] Cliquer sur "Passer à Pro" (ou n'importe quel plan)
- [ ] Vérifier que vous êtes redirigé vers Stripe (pas d'erreur)

### Étape 2 : Vérifier le mode Stripe
- [ ] Sur la page de paiement Stripe
- [ ] Vérifier qu'il n'y a **PAS** de mention "MODE DE TEST"
- [ ] Vérifier que le montant affiché est correct

### Étape 3 : Vérifier les Price ID (optionnel)
- [ ] Dans Stripe Dashboard (mode Production)
- [ ] Vérifier qu'une nouvelle session a été créée
- [ ] Vérifier que le Price ID dans la session correspond à celui configuré

## 🚨 Si ça ne fonctionne toujours pas

### Vérifier que toutes les variables sont bien configurées

1. Vercel Dashboard → Settings → Environment Variables
2. Vérifiez que vous avez bien **6 Price ID** :
   - `STRIPE_STARTER_MONTHLY_PRICE_ID`
   - `STRIPE_STARTER_ANNUAL_PRICE_ID`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_ANNUAL_PRICE_ID`
   - `STRIPE_BUSINESS_MONTHLY_PRICE_ID`
   - `STRIPE_BUSINESS_ANNUAL_PRICE_ID`

3. Vérifiez que les clés sont bien de production :
   - `STRIPE_SECRET_KEY` commence par `sk_live_`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` commence par `pk_live_`

### Vérifier que les Price ID existent en production

1. Stripe Dashboard → Mode **PRODUCTION**
2. Products → Vérifiez que chaque Price ID existe
3. Si un Price ID n'existe pas, créez-le

## ✅ Checklist finale

- [ ] Tous les Price ID mis à jour dans Vercel
- [ ] Déploiement terminé et réussi
- [ ] Test de création de session → Redirection vers Stripe
- [ ] Pas de "MODE DE TEST" sur la page Stripe
- [ ] Montants affichés corrects

## 🎉 Si tout fonctionne

Félicitations ! Votre système de paiement est maintenant en production. Vous pouvez :
- Accepter de vrais paiements
- Les clients peuvent s'abonner avec leurs cartes bancaires
- Les webhooks mettront à jour automatiquement les abonnements

