import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { data: connection, error: fetchError } = await supabase
      .from('email_accounts')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !connection || connection.user_id !== user.id) {
      return NextResponse.json({ error: 'Connexion introuvable' }, { status: 404 });
    }

    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ Erreur suppression:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
