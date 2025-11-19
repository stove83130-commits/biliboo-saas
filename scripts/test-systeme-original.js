/**
 * TEST DU SYSTÈME ORIGINAL ULTRA-SIMPLE
 * Vérification que la détection par mots-clés fonctionne correctement
 */

// MOTS-CLÉS ÉTENDUS POUR DÉTECTION DE FACTURES
const motsClesFactures = [
  // Français
  'facture', 'reçu', 'note de frais', 'avoir', 'devis', 'commande',
  
  // Anglais  
  'receipt', 'invoice', 'bill', 'statement', 'order',
  'your receipt', 'tax invoice', 'e-receipt', 'payment confirmation',
  
  // Autres langues communes
  'rechnung', 'quittung',  // Allemand
  'ricevuta', 'fattura',   // Italien
  'recibo', 'factura',     // Espagnol/Portugais
  
  // Mots commerciaux spécifiques
  'purchase confirmation', 'transaction receipt', 'billing statement',
  'confirmation d\'achat', 'reçu de transaction', 'état de facturation'
];

/**
 * DÉTECTION SIMPLE ET EFFICACE
 */
function estUneFacture(email) {
  const subject = email.subject?.toLowerCase() || '';
  const body = email.body?.toLowerCase() || '';
  
  // Vérifier si l'email contient UN des mots-clés
  return motsClesFactures.some(mot => 
    subject.includes(mot) || body.includes(mot)
  );
}

console.log('🧪 TEST DU SYSTÈME ORIGINAL ULTRA-SIMPLE');
console.log('==========================================\n');

const testEmails = [
  // VRAIES FACTURES - DOIVENT ÊTRE DÉTECTÉES
  {
    subject: 'Facture Ohlala',
    from: 'billing@ohlala.com',
    body: 'Voici votre facture pour les services.',
    attachments: []
  },
  {
    subject: 'Your receipt from Amazon',
    from: 'receipts@amazon.com',
    body: 'Thank you for your purchase. Total: $25.99.',
    attachments: []
  },
  {
    subject: 'Invoice #INV-2024-001',
    from: 'billing@acmecorp.com',
    body: 'Please find attached your invoice. Amount: €199.99.',
    attachments: []
  },
  {
    subject: 'Payment confirmation',
    from: 'payments@stripe.com',
    body: 'Your payment of $50.00 has been processed.',
    attachments: []
  },
  {
    subject: 'Reçu de commande #12345',
    from: 'orders@store.com',
    body: 'Merci pour votre commande. Total: €75.00.',
    attachments: []
  },
  
  // EMAILS NON-FACTURES - NE DOIVENT PAS ÊTRE DÉTECTÉS
  {
    subject: 'Newsletter Weekly Update',
    from: 'stove83130@gmail.com',
    body: 'This is a weekly newsletter. Just updates and news about our products.',
    attachments: []
  },
  {
    subject: 'IT\'S DROP DAY 💥',
    from: 'marketing@brand.com',
    body: 'Check out our new collection!',
    attachments: []
  },
  {
    subject: 'Demain 20:00, live avec Loïc !',
    from: 'events@platform.com',
    body: 'Rejoignez-nous pour notre live demain.',
    attachments: []
  },
  {
    subject: 'JACQUEMUS - NEW IN',
    from: 'newsletter@jacquemus.com',
    body: 'Découvrez nos nouvelles collections.',
    attachments: []
  },
  {
    subject: 'Les 3 mantras grâce auxquels les cadres réussissent',
    from: 'content@blog.com',
    body: 'Article intéressant sur le leadership.',
    attachments: []
  }
];

let facturesDetectees = 0;
let emailsExclus = 0;

console.log('📧 TEST DES EMAILS:\n');

testEmails.forEach((email, index) => {
  const estDetecte = estUneFacture(email);
  
  console.log(`${index + 1}. "${email.subject}"`);
  console.log(`   📧 De: ${email.from}`);
  
  // Vérifier quel mot-clé correspond
  const subject = email.subject?.toLowerCase() || '';
  const body = email.body?.toLowerCase() || '';
  const motDetecte = motsClesFactures.find(mot => 
    subject.includes(mot) || body.includes(mot)
  );
  
  if (estDetecte) {
    console.log(`   ✅ DÉTECTÉ COMME FACTURE (mot-clé: "${motDetecte}")`);
    console.log(`   📝 Corps: "${body.substring(0, 100)}..."`);
    facturesDetectees++;
  } else {
    console.log(`   ❌ EXCLUS (pas une facture)`);
    emailsExclus++;
  }
  
  console.log('');
});

console.log('📊 RÉSULTATS FINAUX:');
console.log(`   ✅ Factures détectées: ${facturesDetectees}`);
console.log(`   ❌ Emails exclus: ${emailsExclus}`);
console.log(`   📈 Total: ${testEmails.length}`);

// Vérification des résultats attendus
const facturesAttendues = 5; // Les 5 premiers emails sont des factures
const exclusionsAttendues = 5; // Les 5 derniers ne sont pas des factures

if (facturesDetectees === facturesAttendues && emailsExclus === exclusionsAttendues) {
  console.log('\n🎉 SUCCÈS ! Le système original fonctionne parfaitement !');
  console.log('   ✅ Toutes les vraies factures sont détectées');
  console.log('   ✅ Tous les emails non-factures sont exclus');
} else {
  console.log('\n⚠️  ATTENTION ! Le système ne fonctionne pas comme attendu.');
  console.log(`   Attendu: ${facturesAttendues} factures, ${exclusionsAttendues} exclus`);
  console.log(`   Obtenu: ${facturesDetectees} factures, ${emailsExclus} exclus`);
}

console.log('\n🔍 MOTS-CLÉS UTILISÉS:');
motsClesFactures.forEach((mot, index) => {
  console.log(`   ${index + 1}. ${mot}`);
});
