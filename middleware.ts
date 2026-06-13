import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow login page and API routes through
  if (pathname.startsWith('/login') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const auth = req.cookies.get('lh_ops_auth')?.value
  if (auth === process.env.APP_PASSWORD) {
    return NextResponse.next()
  }

  // Redirect to login
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
