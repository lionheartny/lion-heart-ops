import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

  // Set auth cookie — httpOnly, secure, 30-day expiry
  res.cookies.set('lh_ops_auth', process.env.APP_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return res
}
