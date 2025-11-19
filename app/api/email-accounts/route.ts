import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()$n    const user = session?.user || null
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer tous les comptes email connectés depuis la table unifiée
    const { data: emailAccounts, error: emailError } = await supabase
      .from('email_accounts')
      .select('id, email, provider, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (emailError) {
      console.error('Erreur email accounts:', emailError)
      return NextResponse.json({ error: 'Failed to fetch email accounts' }, { status: 500 })
    }

    // Formater les comptes
    const allAccounts = (emailAccounts || []).map(account => ({
      id: account.id,
      email: account.email,
      provider: account.provider as 'gmail' | 'outlook',
      connected_at: account.created_at
    }))

    console.log('📧 Comptes email trouvés:', allAccounts.length)

    return NextResponse.json(allAccounts)
  } catch (error) {
    console.error('Erreur lors de la récupération des comptes email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
