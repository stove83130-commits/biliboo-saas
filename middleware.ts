import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Pour le moment, on désactive COMPLÈTEMENT le middleware
  // On va le réactiver progressivement après
  return NextResponse.next()
}

export const config = {
  matcher: [],  // Ne match AUCUNE route
}
