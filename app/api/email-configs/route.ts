/**
 * API Endpoint pour gérer les configurations email
 * GET /api/email-configs - Liste les configurations
 * POST /api/email-configs - Crée une nouvelle configuration
 */


export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 1. Authentification utilisateur
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer les configurations email
    const { data: configs, error: configsError } = await supabaseService
      .from('email_configurations')
      .select('*, clients!inner(*)')
      .eq('clients.user_id', user.id)
      .order('created_at', { ascending: false });

    if (configsError) {
      console.error('❌ Erreur récupération configs:', configsError);
      return NextResponse.json(
        { error: 'Erreur récupération configurations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error: any) {
    console.error('❌ Erreur API configs:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentification utilisateur
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Parse du body
    const body = await req.json();
    const {
      emailProvider,
      imapHost,
      imapPort,
      imapEmail,
      imapPassword,
      oauthAccessToken,
      oauthRefreshToken,
    } = body;

    if (!emailProvider || !imapEmail) {
      return NextResponse.json(
        { error: 'Paramètres manquants: emailProvider et imapEmail requis' },
        { status: 400 }
      );
    }

    // 3. Récupérer ou créer le client
    let { data: client } = await supabaseService
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!client) {
      const { data: newClient, error: clientError } = await supabaseService
        .from('clients')
        .insert({
          user_id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email,
          active: true,
        })
        .select()
        .single();

      if (clientError) {
        console.error('❌ Erreur création client:', clientError);
        return NextResponse.json(
          { error: 'Erreur création client' },
          { status: 500 }
        );
      }

      client = newClient;
    }

    // 4. Créer la configuration email
    const { data: config, error: configError } = await supabaseService
      .from('email_configurations')
      .insert({
        client_id: client.id,
        email_provider: emailProvider,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_email: imapEmail,
        imap_password: imapPassword, // TODO: Crypter
        oauth_access_token: oauthAccessToken, // TODO: Crypter
        oauth_refresh_token: oauthRefreshToken, // TODO: Crypter
        is_active: true,
      })
      .select()
      .single();

    if (configError) {
      console.error('❌ Erreur création config:', configError);
      return NextResponse.json(
        { error: 'Erreur création configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error('❌ Erreur API création config:', error);
    return NextResponse.json(
      {
        error: 'Erreur interne du serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}



