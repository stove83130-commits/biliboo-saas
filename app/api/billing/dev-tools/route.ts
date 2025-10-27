import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const { action, userId } = await request.json()
    
    if (action !== 'reset_usage') {
      return NextResponse.json({ error: 'Action non supportée' }, { status: 400 })
    }

    const supabase = createClient()
    
    // En développement, utiliser l'userId fourni ou récupérer le premier utilisateur
    let targetUserId = userId
    
    if (!targetUserId) {
      // Récupérer le premier utilisateur pour le développement
      const { data: users, error: listError } = await supabase.auth.admin.listUsers()
      if (listError || !users?.users?.length) {
        return NextResponse.json({ error: 'Aucun utilisateur trouvé' }, { status: 404 })
      }
      targetUserId = users.users[0].id
    }

    // Remettre le quota à 0
    const { error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        usage: 0
      }
    })

    if (updateError) {
      console.error('Erreur reset usage:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la remise à zéro' }, { status: 500 })
    }

    console.log(`✅ Quota remis à 0 pour l'utilisateur ${targetUserId}`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Quota remis à 0 avec succès',
      usage: 0,
      userId: targetUserId
    })

  } catch (error) {
    console.error('Erreur dev-tools:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
