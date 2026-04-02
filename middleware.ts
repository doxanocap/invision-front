import { NextResponse } from 'next/server'

// Middleware disabled: auth is handled client-side via login/refresh flow.
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [] // Disable entirely
}
