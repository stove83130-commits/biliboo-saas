import { NextResponse } from "next/server"


export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'OCR_SPACE_API_KEY',
    'RESEND_API_KEY',
    'EXPORTS_FROM_EMAIL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'MICROSOFT_TENANT_ID',
  ] as const

  const present: Record<string, boolean> = {}
  for (const k of keys) present[k] = !!process.env[k]

  const missing = Object.entries(present)
    .filter(([, ok]) => !ok)
    .map(([k]) => k)

  return NextResponse.json({ ok: missing.length === 0, present, missing })
}









