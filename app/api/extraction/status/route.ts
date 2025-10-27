/**
 * API Endpoint pour récupérer le statut d'un job d'extraction
 * GET /api/extraction/status?jobId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 1. Authentification utilisateur
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer le jobId
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Paramètre jobId requis' },
        { status: 400 }
      );
    }

    // 3. Récupérer le job (utiliser l'ancienne table extraction_jobs)
    const { data: job, error: jobError } = await supabaseService
      .from('extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job d\'extraction introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        emailsFound: job.progress?.emailsAnalyzed || 0,
        invoicesExtracted: job.progress?.invoicesFound || 0,
        errorsCount: job.progress?.errors || 0,
        errorMessage: job.error_message,
        startedAt: job.created_at, // Utiliser created_at comme started_at
        completedAt: job.completed_at,
        createdAt: job.created_at,
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur API statut job:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

