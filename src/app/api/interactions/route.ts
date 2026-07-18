import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { folderForType } from '@/lib/utils'

const SESSION_COOKIE = 'nyc_session'

async function getUserId() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const user = await prisma.user.findUnique({ where: { session_token: token } })
  return user?.id ?? null
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const body = await req.json()
  const {
    entity_id,
    post_id,
    occurrence_id,
    action,
    hide_type,
    session_id,
  } = body

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const interaction = await prisma.userInteraction.create({
    data: {
      user_id: userId,
      entity_id: entity_id ?? null,
      post_id: post_id ?? null,
      occurrence_id: occurrence_id ?? null,
      action,
      hide_type: hide_type ?? null,
      session_id: session_id ?? null,
    },
  })

  // Auto-save on swipe_right
  if (action === 'swipe_right' && entity_id) {
    const entity = await prisma.entity.findUnique({ where: { id: entity_id } })
    if (entity) {
      const folder = folderForType(entity.entity_type)
      await prisma.savedItem.upsert({
        where: { user_id_entity_id: { user_id: userId, entity_id } },
        create: { user_id: userId, entity_id, folder },
        update: {},
      })
    }
  }

  return NextResponse.json({ ok: true, interaction })
}
