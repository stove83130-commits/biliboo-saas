# Comment vérifier si un Price ID est en mode Test ou Production

## 📋 Price ID à vérifier
`price_1SMyHoFxpnUUiFFImDaEwYvG`

## 🔍 Méthode 1 : Vérifier dans Stripe Dashboard (le plus simple)

### En mode PRODUCTION
1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **Basculez en mode PRODUCTION** (bouton en haut à droite qui dit "Test mode" → cliquez pour passer en "Live mode")
3. Allez dans **Products**
4. Recherchez le Price ID `price_1SMyHoFxpnUUiFFImDaEwYvG`
   - Dans la barre de recherche en haut
   - Ou parcourez vos produits et regardez les Price ID
5. **Si vous le trouvez** → C'est un Price ID de **PRODUCTION** ✅
6. **Si vous ne le trouvez pas** → Ce n'est pas un Price ID de production

### En mode TEST
1. Allez sur [Stripe Dashboard](https://dashboard.stripe.com)
2. **Assurez-vous d'être en mode TEST** (bouton en haut à droite doit dire "Test mode")
3. Allez dans **Products**
4. Recherchez le Price ID `price_1SMyHoFxpnUUiFFImDaEwYvG`
5. **Si vous le trouvez** → C'est un Price ID de **TEST** ⚠️
6. **Si vous ne le trouvez pas** → Ce n'est pas un Price ID de test

## 🔍 Méthode 2 : Utiliser le script de vérification

J'ai créé un script qui vérifie automatiquement avec votre clé API :

```bash
# Avec votre clé de production
npx tsx scripts/verify-stripe-price-id.ts price_1SMyHoFxpnUUiFFImDaEwYvG
```

Le script va :
- Utiliser votre `STRIPE_SECRET_KEY` depuis `.env.local`
- Tenter de récupérer le Price avec l'API Stripe
- Vous dire s'il existe et dans quel mode

**Résultats possibles :**
- ✅ **Trouvé avec clé de production** → Price ID de PRODUCTION
- ✅ **Trouvé avec clé de test** → Price ID de TEST
- ❌ **Non trouvé avec clé de production** → Soit le Price ID n'existe pas, soit c'est un Price ID de test
- ❌ **Non trouvé avec clé de test** → Soit le Price ID n'existe pas, soit c'est un Price ID de production

## 🔍 Méthode 3 : Vérifier avec votre clé actuelle

Si vous utilisez une clé de production (`sk_live_...`) :

1. Ouvrez votre terminal
2. Testez avec l'API Stripe :

```bash
# Si vous avez curl installé
curl https://api.stripe.com/v1/prices/price_1SMyHoFxpnUUiFFImDaEwYvG \
  -u sk_live_VOTRE_CLE_SECRETE:
```

**Ou** utilisez le script que j'ai créé :

```bash
# Assurez-vous d'avoir STRIPE_SECRET_KEY dans .env.local
npx tsx scripts/verify-stripe-price-id.ts price_1SMyHoFxpnUUiFFImDaEwYvG
```

## 🎯 Pour votre cas spécifique

### Si vous utilisez des clés de PRODUCTION (`sk_live_...`) :

1. Vérifiez dans Stripe Dashboard en mode **PRODUCTION** si ce Price ID existe
2. Si **OUI** → ✅ C'est bon, c'est un Price ID de production
3. Si **NON** → ❌ C'est un Price ID de test, vous devez le créer en production

### Si vous utilisez des clés de TEST (`sk_test_...`) :

1. Vérifiez dans Stripe Dashboard en mode **TEST** si ce Price ID existe
2. Si **OUI** → ⚠️ C'est un Price ID de test, vous devez le créer en production aussi
3. Si **NON** → ❌ Le Price ID n'existe pas du tout

## ✅ Action à prendre

### Si le Price ID est de TEST mais vos clés sont de PRODUCTION :

1. Allez dans Stripe Dashboard en mode **PRODUCTION**
2. Trouvez le produit correspondant
3. Créez un nouveau **Price** avec les mêmes caractéristiques (montant, récurrence)
4. Copiez le nouveau Price ID de production
5. Mettez à jour la variable dans Vercel

### Exemple pour le plan Starter mensuel :

**En mode TEST :**
- Price ID : `price_1SMyHoFxpnUUiFFImDaEwYvG` (test)

**En mode PRODUCTION :**
- Vous devez créer un nouveau Price → Nouveau Price ID : `price_1ABcDeFgHiJkLmNoPqRsTuVwXyZ` (production)
- Mettez à jour `STRIPE_STARTER_MONTHLY_PRICE_ID` dans Vercel avec ce nouveau Price ID

## 🚨 Important

**Vous ne pouvez PAS utiliser un Price ID de test avec une clé de production !**

- ✅ Clé production (`sk_live_`) + Price ID production → Fonctionne
- ✅ Clé test (`sk_test_`) + Price ID test → Fonctionne
- ❌ Clé production (`sk_live_`) + Price ID test → **NE FONCTIONNE PAS**
- ❌ Clé test (`sk_test_`) + Price ID production → **NE FONCTIONNE PAS**

## 📝 Résultat attendu

Après vérification, vous devriez savoir :
- ✅ Si `price_1SMyHoFxpnUUiFFImDaEwYvG` est de production ou test
- ✅ Quelle action prendre (créer en production si nécessaire)
- ✅ Quels Price ID mettre à jour dans Vercel

