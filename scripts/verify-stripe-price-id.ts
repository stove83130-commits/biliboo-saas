/**
 * Script pour vérifier si un Price ID Stripe est en mode test ou production
 * 
 * Usage: npx tsx scripts/verify-stripe-price-id.ts <PRICE_ID>
 */

import Stripe from 'stripe';

const priceId = process.argv[2];

if (!priceId) {
  console.error('❌ Usage: npx tsx scripts/verify-stripe-price-id.ts <PRICE_ID>');
  process.exit(1);
}

if (!priceId.startsWith('price_')) {
  console.error('❌ Ce n\'est pas un Price ID Stripe valide (doit commencer par "price_")');
  process.exit(1);
}

async function verifyPriceId(priceId: string) {
  // Vérifier avec la clé de production d'abord
  const prodKey = process.env.STRIPE_SECRET_KEY;
  const testKey = process.env.STRIPE_SECRET_KEY?.replace('sk_live_', 'sk_test_') || 
                  process.env.STRIPE_SECRET_KEY?.replace(/sk_live_.*/, 'sk_test_...');

  if (!prodKey) {
    console.error('❌ STRIPE_SECRET_KEY non configurée dans les variables d\'environnement');
    console.log('\n💡 Pour tester avec vos clés:');
    console.log('   1. Créez un fichier .env.local avec vos clés');
    console.log('   2. Exécutez: npx tsx scripts/verify-stripe-price-id.ts', priceId);
    process.exit(1);
  }

  console.log('🔍 Vérification du Price ID:', priceId);
  console.log('');

  // Vérifier si c'est une clé de production ou test
  const isProdKey = prodKey.startsWith('sk_live_');
  const isTestKey = prodKey.startsWith('sk_test_');

  if (isProdKey) {
    console.log('✅ Votre clé API est en mode PRODUCTION (sk_live_...)');
  } else if (isTestKey) {
    console.log('⚠️  Votre clé API est en mode TEST (sk_test_...)');
  } else {
    console.log('❓ Type de clé non reconnu:', prodKey.substring(0, 10) + '...');
  }

  console.log('');

  try {
    // Initialiser Stripe avec la clé configurée
    const stripe = new Stripe(prodKey, {
      apiVersion: '2024-06-20',
    });

    console.log('🔎 Tentative de récupération du Price depuis Stripe...');
    console.log('');

    // Essayer de récupérer le price
    const price = await stripe.prices.retrieve(priceId);

    console.log('✅ Price ID trouvé !');
    console.log('');
    console.log('📋 Informations du Price:');
    console.log('   - ID:', price.id);
    console.log('   - Produit:', price.product);
    console.log('   - Montant:', price.unit_amount ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency?.toUpperCase()}` : 'N/A');
    console.log('   - Type:', price.type);
    console.log('   - Recurring:', price.recurring ? `${price.recurring.interval}` : 'Non');
    console.log('   - Actif:', price.active ? 'Oui' : 'Non');
    console.log('');

    // Déterminer le mode basé sur la clé utilisée
    if (isProdKey) {
      console.log('✅ Ce Price ID existe dans votre compte Stripe en mode PRODUCTION');
      console.log('✅ Compatible avec votre clé API de production');
    } else if (isTestKey) {
      console.log('⚠️  Ce Price ID existe dans votre compte Stripe en mode TEST');
      console.log('❌ INCOMPATIBLE : Vous utilisez une clé de test avec ce Price ID');
      console.log('   → Si vous voulez passer en production, vous devez:');
      console.log('      1. Créer ce Price ID en mode Production dans Stripe Dashboard');
      console.log('      2. Utiliser les clés de production (sk_live_...)');
    }

    console.log('');
    console.log('💡 Pour vérifier dans Stripe Dashboard:');
    console.log('   1. Allez sur https://dashboard.stripe.com');
    if (isProdKey) {
      console.log('   2. Basculez en mode PRODUCTION (en haut à droite)');
      console.log('   3. Products → Trouvez le produit avec ce Price ID');
    } else {
      console.log('   2. Restez en mode TEST (en haut à droite)');
      console.log('   3. Products → Trouvez le produit avec ce Price ID');
    }

  } catch (error: any) {
    console.log('');
    console.error('❌ Erreur lors de la récupération du Price:', error.message);
    console.log('');

    if (error.type === 'StripeInvalidRequestError') {
      if (error.code === 'resource_missing') {
        if (isProdKey) {
          console.log('❌ Ce Price ID n\'existe PAS dans votre compte Stripe en mode PRODUCTION');
          console.log('');
          console.log('💡 Solutions:');
          console.log('   1. Vérifiez que vous êtes bien en mode Production dans Stripe Dashboard');
          console.log('   2. Vérifiez que ce Price ID existe dans votre compte Stripe');
          console.log('   3. Si c\'est un Price ID de test, créez-le en production:');
          console.log('      → Stripe Dashboard (mode Production) > Products > Créez un nouveau Price');
          console.log('   4. Remplacez le Price ID dans Vercel par celui de production');
        } else {
          console.log('❌ Ce Price ID n\'existe PAS dans votre compte Stripe en mode TEST');
        }
      } else {
        console.log('❌ Erreur Stripe:', error.code, '-', error.message);
      }
    } else {
      console.log('❌ Erreur inconnue:', error.message);
    }

    process.exit(1);
  }
}

verifyPriceId(priceId).catch(console.error);

