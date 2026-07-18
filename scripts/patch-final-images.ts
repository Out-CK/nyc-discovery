/**
 * patch-final-images.ts
 *
 * Final pass for the 7 remaining feed entities.
 * Tries Facebook pages, Grub Street, NYT Cooking, and other media.
 *
 * Run: npx tsx scripts/patch-final-images.ts
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

// Ordered list of URLs to try per entity
const FALLBACK_URLS: Record<string, string[]> = {
  'The Four Horsemen': [
    'https://www.facebook.com/TheFourHorsemenBK',
    'https://ny.eater.com/2016/1/15/10777370/four-horsemen-williamsburg-brooklyn-review',
    'https://www.grubstreet.com/2023/04/the-four-horsemen-brooklyn-review.html',
    'https://gothamist.com/food/the-four-horsemen-is-a-wine-bar-in-williamsburg',
  ],
  'Institute of Culinary Education': [
    'https://www.facebook.com/ICEchef',
    'https://www.ice.edu/blog',
    'https://www.ice.edu/new-york',
    'https://ny.eater.com/2022/3/2/22957895/institute-culinary-education-ice-new-york-review',
  ],
  'NYC Pottery': [
    'https://www.facebook.com/nycpottery',
    'https://www.timeout.com/newyork/things-to-do/nyc-pottery',
    'https://gothamist.com/arts-entertainment/pottery-classes-nyc',
  ],
  'Mile High Run Club': [
    'https://www.facebook.com/milehighrunclub',
    'https://www.timeout.com/newyork/fitness/mile-high-run-club',
    'https://ny.eater.com/2019/6/24/18614059/mile-high-run-club-review',
  ],
  'The Clay Studio NYC': [
    'https://www.facebook.com/TheClaystudioNYC',
    'https://www.timeout.com/newyork/things-to-do/the-clay-studio',
    'https://gothamist.com/arts-entertainment/best-pottery-classes-nyc',
  ],
  'Rumble Boxing': [
    'https://www.facebook.com/rumblefitness',
    'https://www.timeout.com/newyork/fitness/rumble',
    'https://www.grubstreet.com/2017/04/rumble-boxing-review.html',
  ],
  'Brooklyn Boulders Williamsburg': [
    'https://www.facebook.com/brooklynboulders',
    'https://www.timeout.com/newyork/things-to-do/brooklyn-boulders',
    'https://gothamist.com/arts-entertainment/brooklyn-boulders-climbing-gym-review',
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
    if (m?.[1] && m[1].startsWith('http') && !m[1].includes('placeholder')) return m[1].trim()
  }
  const schema = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)
  if (schema?.[1]) return schema[1]
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
  console.log('🎯 Final pass for remaining feed entities…\n')

  const names = Object.keys(FALLBACK_URLS)
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
    const urls = FALLBACK_URLS[entity.canonical_name] ?? []
    let imageUrl: string | null = null

    for (const url of urls) {
      imageUrl = await fetchOgImage(url)
      if (imageUrl) {
        console.log(`    via: ${url}`)
        break
      }
      await sleep(300)
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

    await sleep(500)
  }

  console.log(`\n✨ Done — ${updated} updated, ${failed} still missing.\n`)
  await prisma.$disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
