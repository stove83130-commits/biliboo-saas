/**
 * Endpoint Cron pour relancer les jobs d'extraction en "pending"
 * 
 * Cet endpoint peut être appelé par Vercel Cron Jobs ou un service externe
 * pour relancer automatiquement les jobs qui sont restés en "pending"
 * (probablement parce que l'extraction directe a été interrompue par Vercel)
 * 
 * GET /api/cron/process-pending-extractions
 * 
 * Sécurité: Vérifier le header "Authorization" avec un secret partagé
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { processExtractionInBackground } from '@/app/api/extraction/process/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // Vérifier l'autorisation (secret partagé pour les cron jobs)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'change-me-in-production';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Cron: Recherche des jobs en pending...');

    // Récupérer tous les jobs en "pending" créés il y a plus de 30 secondes
    // (pour éviter de relancer des jobs qui viennent d'être créés)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    
    const { data: pendingJobs, error: jobsError } = await supabaseService
      .from('extraction_jobs')
      .select('*, email_connections(*)')
      .eq('status', 'pending')
      .lt('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: true })
      .limit(5); // Limiter à 5 jobs par exécution pour éviter la surcharge

    if (jobsError) {
      console.error('❌ Erreur récupération jobs pending:', jobsError);
      return NextResponse.json(
        { error: 'Erreur récupération jobs', details: jobsError.message },
        { status: 500 }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('✅ Aucun job en pending à traiter');
      return NextResponse.json({
        success: true,
        message: 'Aucun job en pending à traiter',
        jobsProcessed: 0,
      });
    }

    console.log(`📋 ${pendingJobs.length} job(s) en pending trouvé(s), démarrage traitement...`);

    const results = [];

    for (const job of pendingJobs) {
      try {
        // Vérifier que le job n'a pas été traité entre-temps
        const { data: currentJob } = await supabaseService
          .from('extraction_jobs')
          .select('status')
          .eq('id', job.id)
          .single();

        if (currentJob?.status !== 'pending') {
          console.log(`⏭️ Job ${job.id} déjà traité (status: ${currentJob?.status}), ignoré`);
          results.push({ jobId: job.id, status: 'skipped', reason: 'already_processed' });
          continue;
        }

        // Récupérer l'utilisateur et le compte email
        const { data: emailAccount } = await supabaseService
          .from('email_connections')
          .select('*')
          .eq('id', job.connection_id)
          .single();

        if (!emailAccount) {
          console.error(`❌ Compte email introuvable pour job ${job.id}`);
          await supabaseService
            .from('extraction_jobs')
            .update({
              status: 'failed',
              error_message: 'Compte email introuvable',
            })
            .eq('id', job.id);
          results.push({ jobId: job.id, status: 'failed', reason: 'email_account_not_found' });
          continue;
        }

        // Marquer le job comme "processing"
        await supabaseService
          .from('extraction_jobs')
          .update({
            status: 'processing',
            progress: {
              ...(job.progress || {}),
              processing_started_at: new Date().toISOString(),
            },
          })
          .eq('id', job.id);

        console.log(`🚀 Relance job ${job.id} via cron...`);

        // Lancer l'extraction en arrière-plan
        processExtractionInBackground(job.id, job.user_id, job, emailAccount)
          .then(() => {
            console.log(`✅ Job ${job.id} terminé avec succès via cron`);
          })
          .catch((error) => {
            console.error(`❌ Erreur job ${job.id} via cron:`, error);
          });

        results.push({ jobId: job.id, status: 'started' });
      } catch (error: any) {
        console.error(`❌ Erreur traitement job ${job.id}:`, error);
        results.push({ jobId: job.id, status: 'error', error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} job(s) traité(s)`,
      jobsProcessed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('❌ Erreur cron process-pending-extractions:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors du traitement des jobs pending',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

