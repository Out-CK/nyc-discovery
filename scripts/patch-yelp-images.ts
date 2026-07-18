/**
 * patch-yelp-images.ts
 *
 * Last-resort pass for entities that block direct scraping.
 * Tries Yelp business pages (reliable og:image).
 *
 * Run: npx tsx scripts/patch-yelp-images.ts
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

const TIMEOUT_MS = 12_000

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Verified Yelp slugs for each entity
const YELP_SLUGS: Record<string, string[]> = {
  'Brooklyn Boulders Williamsburg': [
    'brooklyn-boulders-brooklyn-2',
    'brooklyn-boulders-brooklyn',
  ],
  'Institute of Culinary Education': [
    'institute-of-culinary-education-new-york',
    'institute-of-culinary-education-new-york-2',
  ],
  'Mile High Run Club': [
    'mile-high-run-club-new-york',
    'mile-high-run-club-new-york-2',
  ],
  'NYC Pottery': [
    'nyc-pottery-brooklyn',
    'nyc-pottery-new-york',
    'nyc-pottery-new-york-2',
  ],
  'Rockwood Music Hall': [
    'rockwood-music-hall-new-york',
    'rockwood-music-hall-new-york-2',
  ],
  'Rumble Boxing': [
    'rumble-boxing-new-york',
    'rumble-boxing-new-york-2',
    'rumble-new-york',
  ],
  'The Clay Studio NYC': [
    'the-clay-studio-nyc-brooklyn',
    'the-clay-studio-brooklyn',
    'clay-studio-nyc-brooklyn',
  ],
  'The Fhitting Room': [
    'the-fhitting-room-new-york',
    'the-fhitting-room-new-york-2',
  ],
  'The Four Horsemen': [
    'the-four-horsemen-brooklyn',
    'the-four-horsemen-brooklyn-2',
  ],
}

function extractOgImage(html: string): string | null {
  const patterns = [
    /property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i,
    /content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i,
    /name=[\"']twitter:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i,
    /content=[\"']([^\"']+)[\"'][^>]+name=[\"']twitter:image[\"']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1] && m[1].startsWith('http') && !m[1].includes('placeholder') && !m[1].includes('yelp-logo')) return m[1].trim()
  }
  return null
}

async function fetchOgImage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    return extractOgImage(html)
  } catch { return null }
  finally { clearTimeout(timer) }
}

async function run() {
  console.log('🍴 Trying Yelp pages for remaining feed entities…\n')

  const names = Object.keys(YELP_SLUGS)
  const entities = await prisma.entity.findMany({
    where: {
      canonical_name: { in: names },
      media: { some: { is_primary: true, source_url: { contains: 'unsplash' } } },
    },
    select: {
      id: true,
      canonical_name: true,
      media: { where: { is_primary: true }, select: { id: true }, take: 1 },
    },
  })

  console.log(`Found ${entities.length} entities to try.\n`)

  let updated = 0
  let failed = 0

  for (const entity of entities) {
    const slugs = YELP_SLUGS[entity.canonical_name] ?? []
    let imageUrl: string | null = null

    for (const slug of slugs) {
      const url = `https://www.yelp.com/biz/${slug}`
      imageUrl = await fetchOgImage(url)
      if (imageUrl) break
      await sleep(500)
    }

    if (!imageUrl) {
      console.log(`  ⚠️  ${entity.canonical_name}`)
      failed++
    } else {
      const mediaId = entity.media[0]?.id
      if (mediaId) {
        await prisma.media.update({
          where: { id: mediaId },
          data: { source_url: imageUrl, thumbnail_url: imageUrl, source_platform: 'direct', rights_status: 'linked' },
        })
        console.log(`  ✅  ${entity.canonical_name}`)
        updated++
      }
    }

    await sleep(800)
  }

  console.log(`\n✨ Done — ${updated} updated, ${failed} still missing.\n`)
  await prisma.$disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
