import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    const user = session?.user || null
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripeCustomerId = user.user_metadata?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ payments: [] })
    }

    // Récupérer les paiements Stripe du client
    const payments = await stripe.paymentIntents.list({
      customer: stripeCustomerId,
      limit: 20,
    })

    // Récupérer aussi les factures Stripe
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 20,
    })

    // Combiner et formater les données
    const paymentHistory = [
      ...payments.data.map(payment => ({
        id: payment.id,
        type: 'payment',
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        created: new Date(payment.created * 1000).toISOString(),
        description: payment.description || 'Paiement Bilibou',
        receipt_url: payment.charges?.data[0]?.receipt_url || null,
      })),
      ...invoices.data.map(invoice => ({
        id: invoice.id,
        type: 'invoice',
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: new Date(invoice.created * 1000).toISOString(),
        description: invoice.description || `Facture ${invoice.number || invoice.id}`,
        receipt_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
      }))
    ].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())

    return NextResponse.json({ payments: paymentHistory })
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des paiements' }, { status: 500 })
  }
}




