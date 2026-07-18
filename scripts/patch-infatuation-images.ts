/**
 * patch-infatuation-images.ts
 *
 * For entities still using Unsplash placeholders, tries fetching
 * their og:image from The Infatuation and Eater NY review pages,
 * which have reliable professional photography.
 *
 * Run: npx tsx scripts/patch-infatuation-images.ts
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

const TIMEOUT_MS = 10_000

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractOgImage(html: string, base: string): string | null {
  const patterns = [
    /property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1] && m[1].startsWith('http')) return m[1].trim()
  }
  // Try schema.org
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
    return extractOgImage(html, url)
  } catch { return null }
  finally { clearTimeout(timer) }
}

async function getImageForVenue(name: string, entityType: string): Promise<string | null> {
  const slug = slugify(name)

  // Try The Infatuation (great restaurant/bar photography)
  const infatuationUrls = [
    `https://www.theinfatuation.com/new-york/reviews/${slug}`,
    `https://www.theinfatuation.com/new-york/guides/${slug}`,
  ]
  for (const url of infatuationUrls) {
    const img = await fetchOgImage(url)
    if (img && !img.includes('placeholder')) return img
    await sleep(200)
  }

  // Try Eater NY
  const eaterUrls = [
    `https://ny.eater.com/venues/${slug}`,
    `https://ny.eater.com/maps/${slug}-nyc`,
  ]
  for (const url of eaterUrls) {
    const img = await fetchOgImage(url)
    if (img) return img
    await sleep(200)
  }

  // Try TimeOut NY
  const timeoutUrl = `https://www.timeout.com/newyork/restaurants/${slug}`
  const timeoutImg = await fetchOgImage(timeoutUrl)
  if (timeoutImg) return timeoutImg

  return null
}

async function run() {
  console.log('🔍 Trying Infatuation/Eater/TimeOut for remaining placeholders…\n')

  const entities = await prisma.entity.findMany({
    where: {
      media: { some: { is_primary: true, source_url: { contains: 'unsplash' } } },
      website: { not: { contains: 'example.com' } },
    },
    select: {
      id: true,
      canonical_name: true,
      entity_type: true,
      media: { where: { is_primary: true }, select: { id: true }, take: 1 },
    },
  })

  console.log(`Found ${entities.length} entities still needing images.\n`)

  let updated = 0
  let failed = 0

  for (const entity of entities) {
    const imageUrl = await getImageForVenue(entity.canonical_name, entity.entity_type)

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

    await sleep(300)
  }

  console.log(`\n✨ Done — ${updated} updated, ${failed} still missing.\n`)
  await prisma.$disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
