import { NextResponse } from "next/server"
import OpenAI from "openai"


export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY_missing' }, { status: 500 })
    const openai = new OpenAI({ apiKey })
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'pong' }],
      max_tokens: 5,
      temperature: 0,
    })
    const content = r.choices?.[0]?.message?.content || ''
    return NextResponse.json({ ok: true, contentLength: content.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'openai_error' }, { status: 500 })
  }
}















