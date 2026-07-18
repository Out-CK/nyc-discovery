import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [
    entityCount,
    postCount,
    userCount,
    interactionCount,
    savedCount,
    entityByType,
    recentInteractions,
  ] = await Promise.all([
    prisma.entity.count(),
    prisma.post.count({ where: { is_active: true } }),
    prisma.user.count(),
    prisma.userInteraction.count(),
    prisma.savedItem.count(),
    prisma.entity.groupBy({ by: ['entity_type'], _count: { id: true } }),
    prisma.userInteraction.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        action: true,
        timestamp: true,
        entity: { select: { canonical_name: true } },
      },
    }),
  ])

  const swipes = await prisma.userInteraction.groupBy({
    by: ['action'],
    _count: { id: true },
    where: { action: { in: ['swipe_left', 'swipe_right', 'save'] } },
  })

  return NextResponse.json({
    entityCount,
    postCount,
    userCount,
    interactionCount,
    savedCount,
    entityByType,
    swipes,
    recentInteractions,
  })
}
