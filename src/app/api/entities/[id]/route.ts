import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/entities/[id]'>
) {
  const { id } = await ctx.params

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      media: { orderBy: { ranking_score: 'desc' } },
      reviews: true,
      occurrences: {
        where: {
          OR: [
            { end_time: null },
            { end_time: { gte: new Date() } },
          ],
        },
        orderBy: { start_time: 'asc' },
        take: 10,
      },
      source_records: true,
    },
  })

  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ entity })
}
