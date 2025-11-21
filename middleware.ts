import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // DÉSACTIVÉ COMPLÈTEMENT
  return NextResponse.next()
}

export const config = {
  matcher: [],  // Ne match AUCUNE route
}
