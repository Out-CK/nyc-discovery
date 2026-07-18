import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const limit = 25

  const posts = await prisma.post.findMany({
    include: {
      entity: { select: { canonical_name: true, entity_type: true, neighborhood: true } },
      occurrence: { select: { title: true, start_time: true, event_status: true } },
      _count: { select: { interactions: true } },
    },
    orderBy: [{ boost_score: 'desc' }, { quality_score: 'desc' }],
    skip: page * limit,
    take: limit,
  })

  const total = await prisma.post.count()

  return NextResponse.json({ posts, total, page, limit })
}

export async function PATCH(req: NextRequest) {
  const { id, is_active, boost_score } = await req.json()
  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(is_active !== undefined ? { is_active } : {}),
      ...(boost_score !== undefined ? { boost_score } : {}),
    },
  })
  return NextResponse.json({ post })
}
