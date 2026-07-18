import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const type = searchParams.get('type') ?? undefined
  const search = searchParams.get('q') ?? undefined
  const limit = 25

  const entities = await prisma.entity.findMany({
    where: {
      ...(type ? { entity_type: type } : {}),
      ...(search
        ? {
            OR: [
              { canonical_name: { contains: search } },
              { neighborhood: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { media: true, posts: true, interactions: true } },
      reviews: true,
    },
    orderBy: { created_at: 'desc' },
    skip: page * limit,
    take: limit,
  })

  const total = await prisma.entity.count({
    where: {
      ...(type ? { entity_type: type } : {}),
    },
  })

  return NextResponse.json({ entities, total, page, limit })
}
