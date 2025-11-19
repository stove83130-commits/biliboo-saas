import { NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'
export async function GET() {
  const demoUrl = process.env.NEXT_PUBLIC_DEMO_BOOK_URL
  if (!demoUrl) {
    return NextResponse.redirect('http://localhost:3001/onboarding')
  }
  return NextResponse.redirect(demoUrl)
}


