import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export const dynamic = 'force-dynamic'
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null;
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Récupérer la connexion avec le workspace_id
    const { data: connection, error: fetchError } = await supabase
      .from('email_accounts')
      .select('user_id, workspace_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: 'Connexion introuvable' }, { status: 404 });
    }

    // Si la connexion appartient à un workspace, vérifier les permissions
    if (connection.workspace_id && connection.workspace_id !== 'personal') {
      const { canManageEmailConnections } = await import('@/lib/workspaces/permissions')
      const canManage = await canManageEmailConnections(supabase, connection.workspace_id, user.id)
      if (!canManage) {
        return NextResponse.json({ error: "Vous n'avez pas la permission de déconnecter ce compte" }, { status: 403 })
      }
    } else {
      // Pour les comptes personnels, vérifier que c'est le propriétaire
      if (connection.user_id !== user.id) {
        return NextResponse.json({ error: 'Connexion introuvable' }, { status: 404 });
      }
    }

    const { error } = await supabase
      .from('email_accounts')
      .update({ is_active: false })
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
