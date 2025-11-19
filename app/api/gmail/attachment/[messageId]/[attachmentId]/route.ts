import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'


export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string; attachmentId: string } }
) {
  const supabase = createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()$n    const user = session?.user || null
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { messageId, attachmentId } = params
    
    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: 'Message ID and Attachment ID required' }, { status: 400 })
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

    // Télécharger la pièce jointe
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    })

    const attachmentData = response.data.data
    if (!attachmentData) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Décoder la pièce jointe (base64url)
    const buffer = Buffer.from(attachmentData, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment'
      }
    })

  } catch (error) {
    console.error('Gmail attachment error:', error)
    return NextResponse.json(
      { error: 'Failed to download attachment' },
      { status: 500 }
    )
  }
}

