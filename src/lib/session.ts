import { cookies } from 'next/headers'
import { prisma } from './prisma'
import { randomBytes } from 'crypto'

const SESSION_COOKIE = 'nyc_session'

export async function getOrCreateSession() {
  const cookieStore = await cookies()
  const existing = cookieStore.get(SESSION_COOKIE)?.value

  if (existing) {
    const user = await prisma.user.findUnique({
      where: { session_token: existing },
      include: { preferences: true },
    })
    if (user) return user
  }

  // Create anonymous user
  const token = randomBytes(32).toString('hex')
  const user = await prisma.user.create({
    data: { session_token: token },
    include: { preferences: true },
  })

  // Cookie is set in the response — callers must set it
  return { ...user, _newToken: token }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return prisma.user.findUnique({
    where: { session_token: token },
    include: { preferences: true },
  })
}

export function buildSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  }
}
