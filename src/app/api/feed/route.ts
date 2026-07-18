import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { scoreFeed } from '@/lib/recommendation'

const SESSION_COOKIE = 'nyc_session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const sessionId = searchParams.get('session') ?? null

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  let userId: string | null = null
  if (token) {
    const user = await prisma.user.findUnique({ where: { session_token: token } })
    userId = user?.id ?? null
  }

  // Fallback: anonymous cold-start — return top quality posts
  if (!userId) {
    const posts = await prisma.post.findMany({
      where: { is_active: true },
      orderBy: [{ boost_score: 'desc' }, { quality_score: 'desc' }],
      take: 20,
      include: {
        entity: { include: { media: true, reviews: true } },
        occurrence: true,
      },
    })
    return NextResponse.json({ posts, scored: false })
  }

  // Ranked feed
  const scored = await scoreFeed(userId, sessionId, 20, page)
  if (scored.length === 0) {
    // Fallback to most recent posts if scored list is empty
    const posts = await prisma.post.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        entity: { include: { media: true, reviews: true } },
        occurrence: true,
      },
    })
    return NextResponse.json({ posts, scored: false })
  }

  const postIds = scored.map((s) => s.post_id)
  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    include: {
      entity: { include: { media: true, reviews: true } },
      occurrence: true,
    },
  })

  // Preserve score order
  const postMap = new Map(posts.map((p) => [p.id, p]))
  const ordered = scored
    .map((s) => postMap.get(s.post_id))
    .filter(Boolean)

  return NextResponse.json({ posts: ordered, scored: true })
}
