/**
 * API Endpoint pour récupérer une facture spécifique
 * GET /api/invoices-new/[id]
 */


export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentification utilisateur
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer la facture
    const { data: invoice, error: invoiceError } = await supabaseService
      .from('invoices_new')
      .select('*, clients!inner(*), invoice_items(*)')
      .eq('id', params.id)
      .eq('clients.user_id', user.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Facture introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    console.error('❌ Erreur API facture:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}



