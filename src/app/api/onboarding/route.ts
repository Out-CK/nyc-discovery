import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const SESSION_COOKIE = 'nyc_session'

async function getOrCreateUser(): Promise<{ user: { id: string }; newToken: string | null }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const user = await prisma.user.findUnique({ where: { session_token: token } })
    if (user) return { user, newToken: null }
  }

  // Create a new session
  const newToken = randomBytes(32).toString('hex')
  const user = await prisma.user.create({ data: { session_token: newToken } })
  return { user, newToken }
}

export async function POST(req: NextRequest) {
  const { user, newToken } = await getOrCreateUser()

  const body = await req.json()
  const {
    neighborhood_prefs = [],
    interest_tags = [],
    price_sensitivity = 2,
    time_prefs = [],
    indoor_outdoor = 'both',
    solo_or_group = 'both',
  } = body

  const prefs = await prisma.userPreferences.upsert({
    where: { user_id: user.id },
    create: {
      user_id: user.id,
      neighborhood_prefs: JSON.stringify(neighborhood_prefs),
      interest_tags: JSON.stringify(interest_tags),
      price_sensitivity,
      time_prefs: JSON.stringify(time_prefs),
      indoor_outdoor,
      solo_or_group,
      onboarding_completed: true,
    },
    update: {
      neighborhood_prefs: JSON.stringify(neighborhood_prefs),
      interest_tags: JSON.stringify(interest_tags),
      price_sensitivity,
      time_prefs: JSON.stringify(time_prefs),
      indoor_outdoor,
      solo_or_group,
      onboarding_completed: true,
    },
  })

  const res = NextResponse.json({ prefs })

  // Set session cookie if we just created a new user
  if (newToken) {
    res.cookies.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }

  return res
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ prefs: null })

  const user = await prisma.user.findUnique({ where: { session_token: token } })
  if (!user) return NextResponse.json({ prefs: null })

  const prefs = await prisma.userPreferences.findUnique({ where: { user_id: user.id } })
  return NextResponse.json({ prefs })
}
