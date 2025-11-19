import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAddEmailAccount } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planId = user.user_metadata?.selected_plan
    const { count } = await supabase
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const canAdd = canAddEmailAccount(planId, count || 0)

    if (!canAdd) {
      return NextResponse.json({ 
        error: 'plan_limit_reached',
        feature: 'email',
        message: 'Vous avez atteint la limite de comptes e-mail de votre plan actuel.',
        currentCount: count || 0
      }, { status: 403 })
    }

    return NextResponse.json({ canAdd: true })
  } catch (error) {
    console.error('Erreur vérification limite:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

