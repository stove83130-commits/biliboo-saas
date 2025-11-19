import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'


export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const supabase = createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user || null
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const messageId = params.messageId
    
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    // Récupérer le premier compte email de l'utilisateur (pour simplifier)
    const { data: emailAccount, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
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

    // Récupérer le message complet
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    })

    const message = response.data
    
    // Extraire les pièces jointes
    const attachments = []
    const extractAttachments = (part: any) => {
      if (part.filename) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size
        })
      }
      if (part.parts) {
        part.parts.forEach(extractAttachments)
      }
    }

    if (message.payload?.parts) {
      message.payload.parts.forEach(extractAttachments)
    }

    // Extraire les headers
    const headers = message.payload?.headers || []
    const subject = headers.find(h => h.name === 'Subject')?.value || ''
    const from = headers.find(h => h.name === 'From')?.value || ''
    const date = headers.find(h => h.name === 'Date')?.value || ''

    return NextResponse.json({
      message: {
        id: messageId,
        subject,
        from,
        date: new Date(date),
        attachments,
        payload: message.payload
      }
    })

  } catch (error) {
    console.error('Gmail message error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Gmail message' },
      { status: 500 }
    )
  }
}

