/**
 * fetch-og-images.ts
 *
 * For every entity with a real (non-example.com) website, this script:
 *  1. Fetches the page HTML
 *  2. Extracts og:image / twitter:image / first large <img> as fallback
 *  3. Updates the primary Media record in the DB
 *
 * Run:  npx tsx scripts/fetch-og-images.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const rawUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
const filePart = rawUrl.startsWith('file:') ? rawUrl.slice(5) : rawUrl
const dbPath = path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart)
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 12_000
const CONCURRENCY = 6

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/** Pull meta content value from raw HTML */
function extractMeta(html: string, ...properties: string[]): string | null {
  for (const prop of properties) {
    // Match both property= and name= variants, single and double quotes
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
    ]
    for (const re of patterns) {
      const m = html.match(re)
      if (m?.[1] && m[1].startsWith('http')) return m[1].trim()
    }
  }
  return null
}

/** Resolve a potentially relative URL to absolute */
function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}

/** Fetch page HTML with a timeout */
async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NYCDiscovery/1.0; +https://nyc-discovery.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('html')) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Extract the best image URL from a page */
async function getBestImage(website: string): Promise<string | null> {
  const html = await fetchHtml(website)
  if (!html) return null

  // 1. og:image (highest priority — site owner's canonical pick)
  const ogImage = extractMeta(html, 'og:image', 'og:image:secure_url')
  if (ogImage) return resolveUrl(ogImage, website)

  // 2. twitter:image
  const twitterImage = extractMeta(html, 'twitter:image', 'twitter:image:src')
  if (twitterImage) return resolveUrl(twitterImage, website)

  // 3. schema.org image
  const schemaMatch = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)
  if (schemaMatch?.[1]) return schemaMatch[1]

  // 4. First large <img src> that looks like a photo (not an icon)
  const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*/gi)]
  for (const m of imgMatches) {
    const src = m[1]
    if (!src) continue
    if (src.match(/logo|icon|avatar|sprite|pixel|tracking|blank|spacer/i)) continue
    if (src.startsWith('data:')) continue
    const resolved = resolveUrl(src, website)
    if (resolved.startsWith('http')) return resolved
  }

  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🖼️  Fetching real images from official websites…\n')

  // Get all entities with real websites + their primary media record
  const entities = await prisma.entity.findMany({
    where: {
      website: { not: { contains: 'example.com' } },
    },
    select: {
      id: true,
      canonical_name: true,
      website: true,
      media: {
        where: { is_primary: true },
        select: { id: true, source_url: true },
        take: 1,
      },
    },
  })

  console.log(`Found ${entities.length} real entities to update.\n`)

  let updated = 0
  let failed = 0

  // Process in batches for parallelism without hammering servers
  for (let i = 0; i < entities.length; i += CONCURRENCY) {
    const batch = entities.slice(i, i + CONCURRENCY)

    await Promise.all(batch.map(async entity => {
      if (!entity.website) return

      const imageUrl = await getBestImage(entity.website)

      if (!imageUrl) {
        console.log(`  ⚠️  ${entity.canonical_name} — no image found`)
        failed++
        return
      }

      const mediaId = entity.media[0]?.id

      if (mediaId) {
        // Update existing primary media record
        await prisma.media.update({
          where: { id: mediaId },
          data: {
            source_url: imageUrl,
            thumbnail_url: imageUrl,
            source_platform: 'direct',
            rights_status: 'linked',
          },
        })
      } else {
        // Create a new primary media record if none exists
        await prisma.media.create({
          data: {
            entity_id: entity.id,
            media_type: 'image',
            source_platform: 'direct',
            source_url: imageUrl,
            thumbnail_url: imageUrl,
            alt_text: entity.canonical_name,
            rights_status: 'linked',
            ranking_score: 0.9,
            is_primary: true,
          },
        })
      }

      console.log(`  ✅  ${entity.canonical_name}`)
      updated++
    }))

    // Small pause between batches to be polite
    if (i + CONCURRENCY < entities.length) await sleep(500)
  }

  console.log(`\n✨ Done — ${updated} updated, ${failed} failed.\n`)
  await prisma.$disconnect()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
