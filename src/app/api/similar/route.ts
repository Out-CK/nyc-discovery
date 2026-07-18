import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseJSON } from '@/lib/utils'

/**
 * "More like this" — semantic similarity via Claude, not tag overlap.
 *
 * For a source entity, Claude reads the full candidate list (upcoming events
 * with descriptions) and picks the most genuinely similar ones — matching on
 * vibe, format, audience, scale, and scene rather than shared labels — with a
 * one-line reason per pick. Results are cached per entity (24h TTL) so each
 * event costs at most one LLM call a day.
 */

const CACHE_HOURS = 24
const RESULTS = 10
const MAX_CANDIDATES = 250

interface SimilarPick {
  entity_id: string
  reason: string
}

export async function GET(req: NextRequest) {
  const entityId = new URL(req.url).searchParams.get('entity_id')
  if (!entityId) return NextResponse.json({ error: 'entity_id required' }, { status: 400 })

  const source = await prisma.entity.findUnique({
    where: { id: entityId },
    include: { occurrences: { take: 1 }, media: { take: 1 } },
  })
  if (!source) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Cache hit?
  const cached = await prisma.similarEvents.findUnique({ where: { entity_id: entityId } })
  if (cached && Date.now() - cached.computed_at.getTime() < CACHE_HOURS * 3600 * 1000) {
    return NextResponse.json({
      source: shape(source),
      similar: await hydrate(parseJSON<SimilarPick[]>(cached.results, [])),
      cached: true,
    })
  }

  // Candidates: active event posts, excluding the source itself
  const posts = await prisma.post.findMany({
    where: {
      is_active: true,
      entity_id: { not: entityId },
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    include: { entity: true, occurrence: true },
    take: MAX_CANDIDATES,
    orderBy: { boost_score: 'desc' },
  })

  const lines = posts.map((p) => {
    const e = p.entity
    const when = p.occurrence?.start_time
      ? new Date(p.occurrence.start_time).toISOString().slice(0, 10)
      : '?'
    const desc = (e.short_description || '').replace(/\s+/g, ' ').slice(0, 160)
    return `${e.id} | ${e.entity_type} | ${e.canonical_name} | ${e.neighborhood ?? '?'} | ${when} | tags:${e.tags} | ${desc}`
  })

  const sourceDesc = `${source.canonical_name} (${source.entity_type}, ${source.neighborhood ?? 'NYC'})
Tags: ${source.tags}
${(source.full_description || source.short_description || '').slice(0, 600)}`

  const prompt = `You are the recommendation brain for an NYC events app. A user liked this event and asked for "more like this":

SOURCE EVENT:
${sourceDesc}

Pick the ${RESULTS} most genuinely similar upcoming events from the candidates below. Think beyond shared category labels: match on vibe (divey vs polished, intimate vs arena), format (participatory vs spectator, seated vs standing), audience and scene, scale, energy, and cultural adjacency (fans of X would love Y). A jazz fan matches a candlelight classical night better than a stadium pop show, even though both are "concerts". Do NOT pick near-duplicates (same artist/venue/series as the source).

CANDIDATES (id | type | name | neighborhood | date | tags | description):
${lines.join('\n')}

Return ONLY a JSON array, ordered best-first: [{"entity_id": "...", "reason": "<one short sentence, addressed to the user, why this matches>"}]`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'similarity unavailable' }, { status: 503 })

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 8000, // leaves room for a thinking block plus the JSON answer
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!resp.ok) {
    return NextResponse.json({ error: 'similarity failed' }, { status: 502 })
  }
  const data = await resp.json()
  // The model may emit a thinking block first — take the text block, wherever it is
  const text: string =
    (data.content ?? []).find((b: { type: string }) => b.type === 'text')?.text ?? '[]'
  let picks: SimilarPick[] = []
  try {
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    picks = JSON.parse(text.slice(start, end + 1))
  } catch {
    return NextResponse.json({ error: 'similarity parse failed' }, { status: 502 })
  }
  const validIds = new Set(posts.map((p) => p.entity_id))
  picks = picks.filter((p) => p?.entity_id && validIds.has(p.entity_id)).slice(0, RESULTS)

  await prisma.similarEvents.upsert({
    where: { entity_id: entityId },
    create: { entity_id: entityId, results: JSON.stringify(picks) },
    update: { results: JSON.stringify(picks), computed_at: new Date() },
  })

  return NextResponse.json({ source: shape(source), similar: await hydrate(picks), cached: false })
}

function shape(e: { id: string; canonical_name: string; entity_type: string; neighborhood: string | null }) {
  return {
    id: e.id,
    name: e.canonical_name,
    type: e.entity_type,
    neighborhood: e.neighborhood,
  }
}

async function hydrate(picks: SimilarPick[]) {
  if (picks.length === 0) return []
  const entities = await prisma.entity.findMany({
    where: { id: { in: picks.map((p) => p.entity_id) } },
    include: { occurrences: { take: 1 }, media: { where: { is_primary: true }, take: 1 } },
  })
  const byId = new Map(entities.map((e) => [e.id, e]))
  return picks
    .map((p) => {
      const e = byId.get(p.entity_id)
      if (!e) return null
      const occ = e.occurrences[0]
      return {
        entity_id: e.id,
        name: e.canonical_name,
        type: e.entity_type,
        neighborhood: e.neighborhood,
        tags: parseJSON<string[]>(e.tags, []),
        start_time: occ?.start_time ?? null,
        ticket_url: occ?.ticket_url ?? null,
        price: occ?.price ?? null,
        media_url: e.media[0]?.source_url ?? null,
        reason: p.reason,
      }
    })
    .filter(Boolean)
}
