/**
 * Script de test pour la nouvelle architecture
 * Test de l'extraction IMAP et de l'analyse IA
 */

import { extractInvoicesForClient } from '../lib/services/email-extractor';
import { parseInvoiceFile } from '../lib/services/invoice-parser';
import * as fs from 'fs';
import * as path from 'path';

async function testEmailExtraction() {
  console.log('🧪 Test de l\'extraction IMAP...\n');

  // Configuration de test (à remplacer par vos vraies credentials)
  const config = {
    email: process.env.TEST_EMAIL || 'test@gmail.com',
    password: process.env.TEST_PASSWORD || 'your-app-password',
    host: 'imap.gmail.com',
    port: 993,
  };

  try {
    const invoices = await extractInvoicesForClient(config, {
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
      keywords: ['facture', 'invoice', 'reçu'],
    });

    console.log(`✅ ${invoices.length} factures extraites`);

    for (const invoice of invoices.slice(0, 3)) {
      console.log(`\n📧 Facture:`);
      console.log(`   De: ${invoice.emailFrom}`);
      console.log(`   Sujet: ${invoice.emailSubject}`);
      console.log(`   Date: ${invoice.emailDate}`);
      console.log(`   Fichier: ${invoice.filename}`);
      console.log(`   Type: ${invoice.contentType}`);
      console.log(`   Taille: ${(invoice.size / 1024).toFixed(2)} KB`);
    }

    return invoices;
  } catch (error: any) {
    console.error('❌ Erreur extraction:', error.message);
    return [];
  }
}

async function testInvoiceParsing() {
  console.log('\n🧪 Test de l\'analyse IA...\n');

  // Chercher un PDF de test dans le dossier temp
  const tempDir = path.join(process.cwd(), 'temp');
  
  if (!fs.existsSync(tempDir)) {
    console.log('⚠️ Dossier temp/ non trouvé. Créez-le et ajoutez des PDFs de test.');
    return;
  }

  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.pdf'));
  
  if (files.length === 0) {
    console.log('⚠️ Aucun PDF trouvé dans temp/. Ajoutez des PDFs de test.');
    return;
  }

  const testFile = files[0];
  const filePath = path.join(tempDir, testFile);
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`📄 Analyse de: ${testFile}`);

  try {
    const result = await parseInvoiceFile(fileBuffer, 'application/pdf');

    if (result) {
      console.log('\n✅ Analyse réussie:');
      console.log(`   Numéro: ${result.invoiceNumber}`);
      console.log(`   Date: ${result.invoiceDate}`);
      console.log(`   Fournisseur: ${result.vendorName}`);
      console.log(`   Total: ${result.invoiceTotal} ${result.currency}`);
      console.log(`   Items: ${result.items.length}`);

      if (result.items.length > 0) {
        console.log('\n   📦 Items:');
        result.items.forEach((item, i) => {
          console.log(`      ${i + 1}. ${item.description}`);
          console.log(`         Quantité: ${item.quantity}, Prix: ${item.unitPrice}, Montant: ${item.amount}`);
        });
      }
    } else {
      console.log('❌ Échec de l\'analyse');
    }
  } catch (error: any) {
    console.error('❌ Erreur analyse:', error.message);
  }
}

async function main() {
  console.log('🚀 Test de la nouvelle architecture\n');
  console.log('=' .repeat(60));

  // Test 1: Extraction IMAP
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    await testEmailExtraction();
  } else {
    console.log('⚠️ Variables TEST_EMAIL et TEST_PASSWORD non définies. Skip test IMAP.');
  }

  console.log('\n' + '='.repeat(60));

  // Test 2: Analyse IA
  if (process.env.OPENAI_API_KEY) {
    await testInvoiceParsing();
  } else {
    console.log('⚠️ Variable OPENAI_API_KEY non définie. Skip test IA.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Tests terminés');
}

main().catch(console.error);



