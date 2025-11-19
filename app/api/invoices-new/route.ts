/**
 * API Endpoint pour récupérer les factures
 * GET /api/invoices-new?page=1&limit=20&status=success
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 1. Authentification utilisateur
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer les paramètres de requête
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');

    // 3. Construire la requête
    let query = supabaseService
      .from('invoices_new')
      .select('*, clients!inner(*), invoice_items(*)', { count: 'exact' })
      .eq('clients.user_id', user.id);

    if (status) {
      query = query.eq('extraction_status', status);
    }

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    query = query
      .order('invoice_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: invoices, error: invoicesError, count } = await query;

    if (invoicesError) {
      console.error('❌ Erreur récupération factures:', invoicesError);
      return NextResponse.json(
        { error: 'Erreur récupération factures' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur API factures:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}



