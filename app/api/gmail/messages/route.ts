import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'


export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { emailAccountId, maxResults = 50, query = '' } = await request.json()
    
    if (!emailAccountId) {
      return NextResponse.json({ error: 'Email account ID required' }, { status: 400 })
    }

    // Récupérer le compte email
    const { data: emailAccount, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !emailAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Configurer l'OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/auth/gmail/callback`
    )

    oauth2Client.setCredentials({
      access_token: emailAccount.access_token,
      refresh_token: emailAccount.refresh_token,
    })

    // Récupérer les messages
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query
    })

    const messages = response.data.messages || []
    
    // Récupérer les détails de chaque message
    const messageDetails = await Promise.all(
      messages.map(async (message) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date']
          })
          
          const headers = msg.data.payload?.headers || []
          const subject = headers.find(h => h.name === 'Subject')?.value || ''
          const from = headers.find(h => h.name === 'From')?.value || ''
          const date = headers.find(h => h.name === 'Date')?.value || ''
          
          return {
            id: message.id,
            subject,
            from,
            date: new Date(date),
            attachments: msg.data.payload?.parts?.filter(part => part.filename) || []
          }
        } catch (error) {
          console.error('Error fetching message details:', error)
          return null
        }
      })
    )

    const validMessages = messageDetails.filter(msg => msg !== null)

    return NextResponse.json({ messages: validMessages })

  } catch (error) {
    console.error('Gmail messages error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Gmail messages' },
      { status: 500 }
    )
  }
}

