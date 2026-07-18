/**
 * Recommendation engine for NYC Discovery.
 *
 * Scores each candidate post for a given user by combining:
 *  1. Tag affinity   – overlap with tags from posts the user liked
 *  2. Type affinity  – boost for entity types the user engages with
 *  3. Recency        – boost items with events happening soon
 *  4. Geo affinity   – boost items in the user's preferred neighborhoods
 *  5. Quality        – post quality_score + boost_score
 *  6. Diversity      – penalty for repeating the same type consecutively
 *  7. Freshness      – downrank expired / stale events
 */

import { prisma } from './prisma'
import { parseJSON } from './utils'

export interface ScoredPost {
  post_id: string
  entity_id: string
  score: number
}

interface FeedPost {
  id: string
  entity_id: string
  quality_score: number
  boost_score: number
  expires_at: Date | null
  target_neighborhoods: string
  target_tags: string
  occurrence: {
    start_time: Date | null
    end_time: Date | null
    event_status: string
    freshness_score: number
  } | null
  entity: {
    entity_type: string
    tags: string
    neighborhood: string | null
    metadata_completeness: number
    has_good_media: boolean
  }
}

export async function scoreFeed(
  userId: string,
  sessionId: string | null,
  limit = 30,
  page = 0
): Promise<ScoredPost[]> {
  const now = new Date()

  // 1. Load user preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { preferences: true },
  })
  const prefs = user?.preferences
  const neighborhoodPrefs: string[] = prefs
    ? parseJSON(prefs.neighborhood_prefs, [])
    : []
  const interestTags: string[] = prefs
    ? parseJSON(prefs.interest_tags, [])
    : []
  const priceMax = prefs ? prefs.price_sensitivity * 1 : 4

  // 2. Build affinity signals from recent interactions
  const recentLikes = await prisma.userInteraction.findMany({
    where: {
      user_id: userId,
      action: { in: ['swipe_right', 'save', 'open_details'] },
    },
    orderBy: { timestamp: 'desc' },
    take: 200,
    include: {
      entity: { select: { tags: true, entity_type: true } },
    },
  })

  const tagAffinity: Record<string, number> = {}
  const typeAffinity: Record<string, number> = {}
  for (const like of recentLikes) {
    if (like.entity) {
      const tags = parseJSON<string[]>(like.entity.tags, [])
      for (const t of tags) {
        tagAffinity[t] = (tagAffinity[t] ?? 0) + 1
      }
      typeAffinity[like.entity.entity_type] =
        (typeAffinity[like.entity.entity_type] ?? 0) + 1
    }
  }
  // Seed affinity from onboarding interest tags
  for (const t of interestTags) {
    tagAffinity[t] = (tagAffinity[t] ?? 0) + 3
  }

  // Entities merely seen (impression, no swipe) in this session — may return later
  const seenEntityIds = new Set<string>(
    (
      await prisma.userInteraction.findMany({
        where: {
          user_id: userId,
          action: { in: ['impression', 'hide'] },
          session_id: sessionId ?? undefined,
        },
        select: { entity_id: true },
      })
    )
      .map((r) => r.entity_id)
      .filter(Boolean) as string[]
  )

  // Entities the user has actually judged — suppressed across ALL sessions.
  // A right-swipe lives in Saved; a left-swipe was rejected. Neither belongs
  // back in the deck.
  const judgedEntityIds = new Set<string>(
    (
      await prisma.userInteraction.findMany({
        where: {
          user_id: userId,
          action: { in: ['swipe_left', 'swipe_right', 'save'] },
        },
        select: { entity_id: true },
      })
    )
      .map((r) => r.entity_id)
      .filter(Boolean) as string[]
  )

  // 3. Fetch candidate posts
  const candidates = (await prisma.post.findMany({
    where: {
      is_active: true,
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
    },
    include: {
      occurrence: {
        select: {
          start_time: true,
          end_time: true,
          event_status: true,
          freshness_score: true,
        },
      },
      entity: {
        select: {
          entity_type: true,
          tags: true,
          neighborhood: true,
          metadata_completeness: true,
          has_good_media: true,
          price_level: true,
        },
      },
    },
    take: 500,
  })) as unknown as (FeedPost & {
    entity: FeedPost['entity'] & { price_level: number | null }
  })[]

  // 4. Score each candidate
  const scored: ScoredPost[] = []

  for (const post of candidates) {
    if (seenEntityIds.has(post.entity_id)) continue
    if (judgedEntityIds.has(post.entity_id)) continue
    if (post.occurrence?.event_status === 'cancelled') continue

    let score = 0

    // Base quality
    score += post.quality_score * 20
    score += post.boost_score * 10

    // Tag affinity
    const postTags = parseJSON<string[]>(post.entity.tags, [])
    let tagScore = 0
    for (const t of postTags) {
      if (tagAffinity[t]) tagScore += tagAffinity[t]
    }
    score += Math.min(tagScore, 30)

    // Type affinity
    const typeScore = typeAffinity[post.entity.entity_type] ?? 0
    score += Math.min(typeScore * 2, 20)

    // Neighborhood affinity
    const nb = post.entity.neighborhood?.toLowerCase() ?? ''
    if (neighborhoodPrefs.some((p) => p.toLowerCase() === nb)) {
      score += 15
    }

    // Recency boost for events happening soon
    if (post.occurrence?.start_time) {
      const hoursUntil =
        (post.occurrence.start_time.getTime() - now.getTime()) / 3600000
      if (hoursUntil > 0 && hoursUntil < 48) score += 20
      else if (hoursUntil >= 48 && hoursUntil < 168) score += 10
      else if (hoursUntil < 0) score -= 50 // past
    }

    // Metadata completeness + media
    score += post.entity.metadata_completeness * 10
    if (post.entity.has_good_media) score += 5

    // Price sensitivity filter
    const priceLevel = post.entity.price_level ?? 2
    if (priceLevel > priceMax) score -= 10

    // Freshness
    score += (post.occurrence?.freshness_score ?? 1.0) * 5

    // Small random jitter to prevent identical scores
    score += Math.random() * 2

    scored.push({ post_id: post.id, entity_id: post.entity_id, score })
  }

  // 5. Sort, apply diversity, paginate, and reserve exploration slots
  scored.sort((a, b) => b.score - a.score)

  const PAGE_SIZE = 20
  const offset = page * PAGE_SIZE
  const needed = offset + PAGE_SIZE

  const typeById = new Map(candidates.map((c) => [c.id, c.entity.entity_type ?? 'other']))

  // Build the diversity-filtered ranking deep enough to cover the requested
  // page (the previous version capped at one page, so page >= 1 was always
  // empty and the feed silently fell back to unscored recency).
  const ranked: ScoredPost[] = []
  const deferred: ScoredPost[] = []
  const typeWindow: string[] = []
  for (const item of scored) {
    if (ranked.length >= needed) break
    const entityType = typeById.get(item.post_id) ?? 'other'
    // No more than 2 of the same type in a row
    if (
      typeWindow.length >= 2 &&
      typeWindow[typeWindow.length - 1] === entityType &&
      typeWindow[typeWindow.length - 2] === entityType
    ) {
      deferred.push(item)
      continue
    }
    ranked.push(item)
    typeWindow.push(entityType)
  }
  // Backfill from diversity-deferred items if the pool ran short
  for (const item of deferred) {
    if (ranked.length >= needed) break
    ranked.push(item)
  }

  const pageItems = ranked.slice(offset, offset + PAGE_SIZE)

  // Exploration: swap 2 mid-page slots for random below-the-fold candidates so
  // the model keeps learning outside the user's known taste.
  const belowFold = scored.slice(needed)
  for (const slot of [6, 14]) {
    if (belowFold.length === 0 || pageItems.length <= slot) break
    const pick = belowFold.splice(Math.floor(Math.random() * belowFold.length), 1)[0]
    pageItems[slot] = pick
  }

  return pageItems
}
