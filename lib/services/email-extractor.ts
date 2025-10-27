/**
 * Service d'extraction des emails (IMAP/OAuth)
 * Basé sur l'architecture fournie par l'utilisateur
 */

import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';

export interface EmailConfig {
  email: string;
  password?: string;
  host?: string;
  port?: number;
  // Pour OAuth
  accessToken?: string;
  refreshToken?: string;
}

export interface ExtractedEmail {
  seqno: number;
  from: string;
  subject: string;
  date: Date;
  text: string;
  html: string;
  attachments: Attachment[];
  messageId: string;
}

export interface InvoiceAttachment {
  emailFrom: string;
  emailSubject: string;
  emailDate: Date;
  emailId: string;
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface SearchCriteria {
  since?: Date;
  keywords?: string[];
}

export class EmailInvoiceExtractor {
  private imap: Imap;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.imap = new Imap({
      user: config.email,
      password: config.password || '',
      host: config.host || 'imap.gmail.com',
      port: config.port || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('✅ Connexion IMAP établie');
        resolve();
      });
      this.imap.once('error', (err) => {
        console.error('❌ Erreur connexion IMAP:', err);
        reject(err);
      });
      this.imap.connect();
    });
  }

  async searchInvoiceEmails(searchCriteria: SearchCriteria = {}): Promise<ExtractedEmail[]> {
    const {
      since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 jours par défaut
      keywords = ['facture', 'invoice', 'reçu', 'receipt', 'bill'],
    } = searchCriteria;

    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('❌ Erreur ouverture INBOX:', err);
          return reject(err);
        }

        console.log(`📬 INBOX ouvert: ${box.messages.total} messages`);

        // Critères de recherche IMAP
        const searchQuery: any[] = [
          ['SINCE', since],
        ];

        // Ajouter les mots-clés
        if (keywords.length > 0) {
          const keywordQueries = keywords.map((keyword) => ['SUBJECT', keyword]);
          if (keywordQueries.length === 1) {
            searchQuery.push(keywordQueries[0]);
          } else {
            searchQuery.push(['OR', ...keywordQueries]);
          }
        }

        this.imap.search(searchQuery, (err, results) => {
          if (err) {
            console.error('❌ Erreur recherche IMAP:', err);
            return reject(err);
          }

          if (results.length === 0) {
            console.log('ℹ️ Aucun email trouvé');
            return resolve([]);
          }

          console.log(`📧 ${results.length} emails trouvés`);

          const emails: ExtractedEmail[] = [];
          const fetch = this.imap.fetch(results, {
            bodies: '',
            struct: true,
          });

          fetch.on('message', (msg, seqno) => {
            let buffer = '';

            msg.on('body', (stream, info) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', async () => {
                try {
                  const parsed: ParsedMail = await simpleParser(buffer);
                  emails.push({
                    seqno,
                    from: parsed.from?.text || '',
                    subject: parsed.subject || '',
                    date: parsed.date || new Date(),
                    text: parsed.text || '',
                    html: parsed.html || '',
                    attachments: parsed.attachments || [],
                    messageId: parsed.messageId || `${seqno}`,
                  });
                } catch (e) {
                  console.error('❌ Erreur parsing email:', e);
                }
              });
            });
          });

          fetch.once('error', (err) => {
            console.error('❌ Erreur fetch:', err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log(`✅ ${emails.length} emails parsés`);
            resolve(emails);
          });
        });
      });
    });
  }

  async extractAttachments(emails: ExtractedEmail[]): Promise<InvoiceAttachment[]> {
    const invoices: InvoiceAttachment[] = [];

    for (const email of emails) {
      // Extraire les pièces jointes PDF
      const pdfAttachments = email.attachments.filter(
        (att) =>
          att.contentType === 'application/pdf' ||
          att.filename?.toLowerCase().endsWith('.pdf')
      );

      for (const attachment of pdfAttachments) {
        invoices.push({
          emailFrom: email.from,
          emailSubject: email.subject,
          emailDate: email.date,
          emailId: email.messageId,
          filename: attachment.filename || 'invoice.pdf',
          content: attachment.content,
          contentType: attachment.contentType,
          size: attachment.size,
        });
      }

      // Extraire aussi les images (PNG, JPG)
      const imageAttachments = email.attachments.filter((att) =>
        ['image/png', 'image/jpeg', 'image/jpg'].includes(att.contentType)
      );

      for (const attachment of imageAttachments) {
        invoices.push({
          emailFrom: email.from,
          emailSubject: email.subject,
          emailDate: email.date,
          emailId: email.messageId,
          filename: attachment.filename || 'invoice.png',
          content: attachment.content,
          contentType: attachment.contentType,
          size: attachment.size,
        });
      }
    }

    console.log(`💰 ${invoices.length} factures extraites`);
    return invoices;
  }

  disconnect(): void {
    this.imap.end();
    console.log('🔌 Connexion IMAP fermée');
  }
}

/**
 * Fonction utilitaire pour extraire les factures d'un client
 */
export async function extractInvoicesForClient(
  clientConfig: EmailConfig,
  searchCriteria?: SearchCriteria
): Promise<InvoiceAttachment[]> {
  const extractor = new EmailInvoiceExtractor(clientConfig);

  try {
    await extractor.connect();
    const emails = await extractor.searchInvoiceEmails(searchCriteria);
    const invoices = await extractor.extractAttachments(emails);
    extractor.disconnect();

    return invoices;
  } catch (error) {
    console.error('❌ Erreur extraction:', error);
    extractor.disconnect();
    throw error;
  }
}



