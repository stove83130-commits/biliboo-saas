import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';


export const dynamic = 'force-dynamic'
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/auth/gmail/callback`
);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession()$n    const user = session?.user || null;
  
  if (authError || !user) {
    return NextResponse.redirect('/login');
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: user.id,
  });

  return NextResponse.redirect(authUrl);
}
