import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const SESSION_COOKIE = 'nyc_session'

export async function GET(req: Request) {
  const redirectTo = new URL(req.url).searchParams.get('redirect')
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const user = await prisma.user.findUnique({
      where: { session_token: token },
      include: { preferences: true },
    })
    if (user) {
      if (redirectTo?.startsWith('/')) {
        return NextResponse.redirect(new URL(redirectTo, req.url))
      }
      return NextResponse.json({ user })
    }
  }

  // Create new anonymous session
  const newToken = randomBytes(32).toString('hex')
  const user = await prisma.user.create({
    data: { session_token: newToken },
    include: { preferences: true },
  })

  const res = redirectTo?.startsWith('/')
    ? NextResponse.redirect(new URL(redirectTo + (redirectTo.includes('?') ? '&' : '?') + 's=1', req.url))
    : NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}
