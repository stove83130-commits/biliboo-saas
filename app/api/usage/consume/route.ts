import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Récupérer les métadonnées utilisateur
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user.id)
    
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const metadata = userData.user.user_metadata || {}
    const currentUsage = metadata.usage || {}
    
    // Déterminer la période actuelle
    const now = new Date()
    const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    
    // Initialiser l'usage pour cette période si nécessaire
    if (!currentUsage[currentPeriod]) {
      currentUsage[currentPeriod] = { count: 0 }
    }
    
    // Incrémenter le compteur
    currentUsage[currentPeriod].count += 1
    
    // Mettre à jour les métadonnées utilisateur
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...metadata,
        usage: currentUsage
      }
    })

    // Déterminer les limites du plan
    const planKey = metadata.selected_plan || null
    const planLimits = {
      starter: 30,
      pro: 200,
      business: 500,
      enterprise: null // Illimité
    }
    
    const limit = planKey ? planLimits[planKey as keyof typeof planLimits] : 0
    const remaining = limit ? Math.max(0, limit - currentUsage[currentPeriod].count) : null

    return NextResponse.json({
      count: currentUsage[currentPeriod].count,
      remaining,
      limit,
      period: currentPeriod
    })

  } catch (error) {
    console.error('Usage consume error:', error)
    return NextResponse.json(
      { error: 'Failed to consume usage' },
      { status: 500 }
    )
  }
}