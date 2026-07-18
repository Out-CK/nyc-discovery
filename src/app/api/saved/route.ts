import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const SESSION_COOKIE = 'nyc_session'

async function getUserId() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const user = await prisma.user.findUnique({ where: { session_token: token } })
  return user?.id ?? null
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ items: [] })

  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder') ?? undefined

  const items = await prisma.savedItem.findMany({
    where: { user_id: userId, ...(folder ? { folder } : {}) },
    orderBy: { saved_at: 'desc' },
    include: {
      entity: {
        include: { media: true, reviews: true, occurrences: true },
      },
    },
  })

  return NextResponse.json({ items })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const { entity_id } = await req.json()
  await prisma.savedItem.deleteMany({
    where: { user_id: userId, entity_id },
  })

  return NextResponse.json({ ok: true })
}
