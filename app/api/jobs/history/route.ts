import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null;
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { data: jobs, error } = await supabase
      .from('extraction_jobs')
      .select(`
        id,
        start_date,
        end_date,
        status,
        progress,
        created_at,
        completed_at,
        email_accounts!inner(email, provider)
      `)
      .eq('connection_id', user.id) // Utiliser connection_id au lieu de account_id
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ jobs });

  } catch (error: any) {
    console.error('❌ Erreur historique:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
