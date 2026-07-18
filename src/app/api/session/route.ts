import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const SESSION_COOKIE = 'nyc_session'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const user = await prisma.user.findUnique({
      where: { session_token: token },
      include: { preferences: true },
    })
    if (user) {
      return NextResponse.json({ user })
    }
  }

  // Create new anonymous session
  const newToken = randomBytes(32).toString('hex')
  const user = await prisma.user.create({
    data: { session_token: newToken },
    include: { preferences: true },
  })

  const res = NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}
