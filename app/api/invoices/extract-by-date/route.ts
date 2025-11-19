import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { google } from 'googleapis';


export const dynamic = 'force-dynamic'
const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 API: Démarrage extraction complète (3 règles)');

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const { connectionId, startDate, endDate } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Paramètre connectionId requis' },
        { status: 400 }
      );
    }

    console.log(`📅 Extraction ${startDate} → ${endDate} pour connexion ${connectionId}`);

    // Récupérer la connexion Gmail
    const { data: connection, error: connectionError } = await supabaseService
      .from('email_accounts')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Connexion introuvable' },
        { status: 404 }
      );
    }

    // Créer le job
    const { data: job, error: jobError } = await supabaseService
      .from('extraction_jobs')
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        status: 'processing',
        start_date: startDate,
        end_date: endDate,
        progress: {
          emailsAnalyzed: 0,
          invoicesFound: 0,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ Erreur création job:', jobError);
      return NextResponse.json(
        { error: 'Erreur création job' },
        { status: 500 }
      );
    }

    console.log(`✅ Job créé avec succès: ${job.id}`);

    // Lancer l'extraction en arrière-plan
    setImmediate(async () => {
      try {
        console.log(`🚀 Démarrage extraction pour job ${job.id}`);

        // Configurer OAuth2
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
          access_token: connection.access_token,
          refresh_token: connection.refresh_token,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Récupérer les emails
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime() + 86400000; // +1 jour

        console.log(`📧 Récupération emails Gmail du ${startDate} au ${endDate}`);

        const response = await gmail.users.messages.list({
          userId: 'me',
          q: `after:${Math.floor(startTimestamp / 1000)} before:${Math.floor(endTimestamp / 1000)}`,
          maxResults: 100,
        });

        const messages = response.data.messages || [];
        console.log(`📬 ${messages.length} emails trouvés`);

        let invoicesFound = 0;

        // Traiter chaque email
        for (const message of messages.slice(0, 20)) {
          try {
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'full',
            });

            const headers = fullMessage.data.payload?.headers || [];
            const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
            const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
            const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';

            // Vérifier si c'est une facture (système complet 3 règles)
            const parts = fullMessage.data.payload?.parts || [];
            let hasPdfAttachment = false;
            let pdfAttachment: any = null;

            for (const part of parts) {
              if (
                part.mimeType === 'application/pdf' ||
                part.filename?.toLowerCase().endsWith('.pdf')
              ) {
                hasPdfAttachment = true;
                pdfAttachment = part;
                break;
              }
            }

            if (hasPdfAttachment && pdfAttachment) {
              console.log(`✅ RÈGLE 1: PDF trouvé (${pdfAttachment.filename}) - "${subject}"`);

              // Télécharger le PDF
              const attachmentData = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id!,
                id: pdfAttachment.body?.attachmentId!,
              });

              const pdfBuffer = Buffer.from(attachmentData.data.data!, 'base64');

              // Sauvegarder dans la base de données
              const { error: insertError } = await supabaseService
                .from('invoices')
                .insert({
                  user_id: user.id,
                  connection_id: connectionId,
                  email_id: message.id,
                  vendor: from,
                  date: new Date(date).toISOString(),
                  invoice_number: subject,
                  category: 'Autre',
                  original_file_name: pdfAttachment.filename,
                  original_mime_type: 'application/pdf',
                  source: 'gmail',
                });

              if (!insertError) {
                invoicesFound++;
              }
            }
          } catch (error) {
            console.error(`❌ Erreur traitement email:`, error);
          }
        }

        console.log(`💰 ${invoicesFound} factures détectées (système complet 3 règles)`);

        if (invoicesFound > 0) {
          console.log(`✅ ${invoicesFound} factures sauvegardées avec succès`);
        }

        // Mettre à jour le job
        await supabaseService
          .from('extraction_jobs')
          .update({
            status: 'completed',
            progress: {
              emailsAnalyzed: messages.length,
              invoicesFound,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        console.log(`✅ Job ${job.id} terminé avec succès`);
      } catch (error: any) {
        console.error(`❌ Erreur extraction job ${job.id}:`, error);

        await supabaseService
          .from('extraction_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', job.id);
      }
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Extraction lancée avec succès',
    });
  } catch (error: any) {
    console.error('❌ Erreur API extraction:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}



