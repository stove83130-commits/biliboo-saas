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

    console.log('🔄 Cron: Recherche des jobs en pending ou processing bloqués...');

    // Récupérer :
    // 1. Les jobs en "pending" créés il y a plus de 30 secondes
    // 2. Les jobs en "processing" qui sont bloqués depuis plus de 2 minutes (probablement interrompus par Vercel)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    // Jobs en pending
    const { data: pendingJobs, error: pendingError } = await supabaseService
      .from('extraction_jobs')
      .select('*, email_connections(*)')
      .eq('status', 'pending')
      .lt('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: true })
      .limit(3);
    
    // Jobs en processing bloqués (processing_started_at > 2 minutes)
    // Note: On récupère tous les jobs en processing et on filtre côté code
    // car Supabase ne supporte pas facilement les comparaisons sur des champs JSON
    const { data: allProcessingJobs, error: stuckError } = await supabaseService
      .from('extraction_jobs')
      .select('*, email_connections(*)')
      .eq('status', 'processing')
      .limit(10);
    
    // Filtrer les jobs bloqués (processing_started_at > 2 minutes et pas de progrès)
    const stuckJobs = (allProcessingJobs || []).filter((job: any) => {
      const progress = job.progress || {};
      const processingStartedAt = progress.processing_started_at;
      if (!processingStartedAt) return false;
      
      const startedAt = new Date(processingStartedAt);
      const twoMinutesAgoDate = new Date(twoMinutesAgo);
      
      // Job bloqué si : démarré il y a plus de 2 minutes ET aucun email analysé
      return startedAt < twoMinutesAgoDate && (!progress.emailsAnalyzed || progress.emailsAnalyzed === 0);
    }).slice(0, 2); // Limiter à 2 jobs
    
    const jobsError = pendingError || stuckError;
    const allJobs = [...(pendingJobs || []), ...(stuckJobs || [])];

    if (jobsError) {
      console.error('❌ Erreur récupération jobs pending:', jobsError);
      return NextResponse.json(
        { error: 'Erreur récupération jobs', details: jobsError.message },
        { status: 500 }
      );
    }

    if (!allJobs || allJobs.length === 0) {
      console.log('✅ Aucun job en pending ou processing bloqué à traiter');
      return NextResponse.json({
        success: true,
        message: 'Aucun job à traiter',
        jobsProcessed: 0,
      });
    }

    console.log(`📋 ${allJobs.length} job(s) trouvé(s) (${pendingJobs?.length || 0} pending, ${stuckJobs?.length || 0} processing bloqués), démarrage traitement...`);

    const results = [];

    for (const job of allJobs) {
      try {
        // Vérifier que le job n'a pas été traité entre-temps
        const { data: currentJob } = await supabaseService
          .from('extraction_jobs')
          .select('status, progress')
          .eq('id', job.id)
          .single();

        // Si le job est déjà completed ou failed, l'ignorer
        if (currentJob?.status === 'completed' || currentJob?.status === 'failed') {
          console.log(`⏭️ Job ${job.id} déjà terminé (status: ${currentJob?.status}), ignoré`);
          results.push({ jobId: job.id, status: 'skipped', reason: 'already_processed' });
          continue;
        }
        
        // Si le job est en processing mais a progressé récemment (emailsAnalyzed > 0), ne pas le relancer
        if (currentJob?.status === 'processing' && (currentJob?.progress as any)?.emailsAnalyzed > 0) {
          console.log(`⏭️ Job ${job.id} en cours de traitement (${(currentJob?.progress as any)?.emailsAnalyzed} emails analysés), ignoré`);
          results.push({ jobId: job.id, status: 'skipped', reason: 'in_progress' });
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

