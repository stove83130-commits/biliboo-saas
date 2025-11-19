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
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect('/dashboard/connections?error=missing_params');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    const supabase = await createClient();
    
          const { error } = await supabase
            .from('email_accounts')
            .insert({
              user_id: state,
              email: profile.data.emailAddress!,
              provider: 'gmail',
              access_token: tokens.access_token!,
              refresh_token: tokens.refresh_token!,
              token_expires_at: new Date(tokens.expiry_date!).toISOString(),
            });

    if (error) {
      console.error('❌ Erreur insertion connexion:', error);
      return NextResponse.redirect('/dashboard/connections?error=db_error');
    }

    return NextResponse.redirect('/dashboard/connections?connected=gmail');

  } catch (error) {
    console.error('❌ Erreur OAuth:', error);
    return NextResponse.redirect('/dashboard/connections?error=oauth_failed');
  }
}
