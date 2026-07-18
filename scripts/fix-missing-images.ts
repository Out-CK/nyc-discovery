/**
 * fix-missing-images.ts
 *
 * For entities that still have Unsplash placeholder images, tries:
 *  1. Known alternative URLs (sub-pages, root domains)
 *  2. Hardcoded verified image URLs for well-known places
 *
 * Run: npx tsx scripts/fix-missing-images.ts
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

function extractMeta(html: string, ...properties: string[]): string | null {
  for (const prop of properties) {
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

function resolveUrl(src: string, base: string): string {
  try { return new URL(src, base).href } catch { return src }
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NYCDiscovery/1.0)', 'Accept': 'text/html' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
  finally { clearTimeout(timer) }
}

async function getBestImage(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const html = await fetchHtml(url)
    if (!html) continue
    const og = extractMeta(html, 'og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src')
    if (og) return resolveUrl(og, url)
    const schema = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)
    if (schema?.[1]) return schema[1]
  }
  return null
}

// ─── Alternative URL strategies per entity name ───────────────────────────────
// For sites that redirect /path to JS-rendered pages, try the root or other paths
const ALTERNATIVE_URLS: Record<string, string[]> = {
  'Lilia': ['https://liliarestaurant.com', 'https://liliarestaurant.com/about'],
  'Olmsted': ['https://olmstednyc.com', 'https://olmstednyc.com/about'],
  'Di Fara Pizza': ['https://www.difara.com', 'https://www.difara.com/menu'],
  'Ugly Baby': ['https://uglybabyny.com', 'https://www.facebook.com/uglybabyny'],
  'Atla': ['https://atlanyc.com', 'https://atlanyc.com/about'],
  'Club Cumming': ['https://clubcumming.com', 'https://www.instagram.com/clubcumming'],
  'Bushwick Collective Block Party': ['https://thebushwickcollective.com'],
  'Rough Trade NYC': ['https://roughtraderecords.com/pages/nyc', 'https://roughtraderecords.com'],
  'MoMA PS1 Warm Up': ['https://www.moma.org/ps1', 'https://www.moma.org'],
  'Brooklyn Museum First Saturdays': ['https://www.brooklynmuseum.org', 'https://www.brooklynmuseum.org/programs/first-saturdays'],
  'Brooklyn Boulders LIC': ['https://brooklynboulders.com', 'https://brooklynboulders.com/longislandcity'],
  'Harlem Textile Works': ['https://www.harlemtextileworks.com', 'https://harlemtextileworks.com'],
  'NY Trapeze School': ['https://newyork.trapezeschool.com', 'https://trapezeschool.com'],
  'Westside Dance Project': ['https://wsdance.org', 'https://www.wsdance.org'],
  'NYC Enamel Arts': ['https://nycenamealarts.com'],
  'Ridgewood Art Studios': ['https://ridgewoodartstudios.com'],
  'NYC Comedy Festival': ['https://nyccomedyfestival.com', 'https://www.nyccomedyfestival.com'],
  'Emmy Squared': ['https://emmyrestaurant.com', 'https://www.emmyrestaurant.com'],
  'Gage & Tollner': ['https://gageandtollner.com', 'https://www.gageandtollner.com'],
  "L'Artusi": ['https://lartusi.com', 'https://www.lartusi.com'],
  'The Four Horsemen': ['https://thefourhorsemenny.com', 'https://www.thefourhorsemenny.com'],
  'Momofuku Noodle Bar': ['https://momofuku.com', 'https://momofuku.com/new-york'],
  'Nan Xiang Xiao Long Bao': ['https://nanxiangusa.com', 'https://www.nanxiangusa.com'],
  'Laser Wolf': ['https://laserwolfnyc.com', 'https://www.laserwolfnyc.com'],
  'Blue Ribbon Brasserie': ['https://www.blueribbonrestaurants.com', 'https://blueribbonrestaurants.com'],
  "Bubby's": ['https://bubbys.com', 'https://www.bubbys.com'],
  'Miss Ada': ['https://missadabrooklyn.com', 'https://www.missadabrooklyn.com'],
  'King': ['https://king-restaurant.com', 'https://www.king-restaurant.com'],
  'Sottocasa': ['https://sottocasanyc.com', 'https://www.sottocasanyc.com'],
  'Motorino': ['https://motorinopizza.com', 'https://www.motorinopizza.com'],
  "Bamonte's": ['https://bamontesny.com', 'https://www.bamontesny.com'],
  'Prune': ['https://prunerestaurant.com', 'https://www.prunerestaurant.com'],
  'The NoMad Bar': ['https://www.thenomadhotel.com', 'https://thenomadhotel.com'],
  'Zoma': ['https://zomanyc.com', 'https://www.zomanyc.com'],
  'Institute of Culinary Education': ['https://www.ice.edu', 'https://ice.edu'],
  'The League of Kitchens': ['https://www.leagueofkitchens.com', 'https://leagueofkitchens.com'],
  'Croghan Supply Co.': ['https://croghan.studio', 'https://www.croghan.studio'],
  'NYC Pottery': ['https://www.nycpottery.com', 'https://nycpottery.com'],
  'The Clay Studio NYC': ['https://theclaystudionyc.com', 'https://www.theclaystudionyc.com'],
  'Mile High Run Club': ['https://themilehighrunclub.com', 'https://www.themilehighrunclub.com'],
  'Alvin Ailey Extension': ['https://www.alvinailey.org', 'https://alvinailey.org'],
  'Eataly Cooking Classes': ['https://www.eataly.com/us_en/stores/nyc-flatiron', 'https://www.eataly.com'],
  'Rumble Boxing': ['https://www.rumblefitness.com', 'https://rumblefitness.com'],
  'Pure Barre': ['https://purebarre.com', 'https://www.purebarre.com'],
  'The Fhitting Room': ['https://thefhittingroom.com', 'https://www.thefhittingroom.com'],
  'Brooklyn Boulders Williamsburg': ['https://brooklynboulders.com', 'https://brooklynboulders.com/williamsburg'],
  'Rockwood Music Hall': ['https://rockwoodmusichall.com', 'https://www.rockwoodmusichall.com'],
  "Joe's Pub": ['https://joespub.publictheater.org', 'https://www.publictheater.org'],
  'City Winery NYC': ['https://citywinery.com', 'https://citywinery.com/new-york'],
  'Smoke Jazz & Supper Club': ['https://www.smokejazz.com', 'https://smokejazz.com'],
  'Carnegie Hall': ['https://www.carnegiehall.org', 'https://carnegiehall.org'],
  'Le Poisson Rouge': ['https://lprnyc.com', 'https://www.lprnyc.com'],
  'The Blue Note': ['https://bluenotejazz.com', 'https://bluenotejazz.com/new-york'],
  'Public Records': ['https://www.publicrecords.nyc', 'https://publicrecords.nyc'],
  'The Public Theater': ['https://www.publictheater.org', 'https://publictheater.org'],
  'Nowadays': ['https://nowadays.nyc', 'https://www.nowadays.nyc'],
  'Caveat NYC': ['https://www.caveat.nyc', 'https://caveat.nyc'],
  'Sleep No More': ['https://sleepnomore.com', 'https://www.sleepnomore.com'],
  'Museum of the Moving Image': ['https://movingimage.us', 'https://www.movingimage.us'],
  'Avant Gardner / Brooklyn Mirage': ['https://avantgardner.com', 'https://www.avantgardner.com'],
  'Angelika Film Center': ['https://angelikafilmcenter.com', 'https://angelikafilmcenter.com/nyc'],
  'Westlight': ['https://www.wythehotel.com', 'https://wythehotel.com'],
  'Cielo': ['https://www.cieloclub.com', 'https://cieloclub.com'],
  'Good Room': ['https://www.goodroombk.com', 'https://goodroombk.com'],
  'Sunnyvale': ['https://www.sunnyvalebar.com', 'https://sunnyvalebar.com'],
  'New Museum': ['https://www.newmuseum.org', 'https://newmuseum.org'],
  'The Shed': ['https://theshed.org', 'https://www.theshed.org'],
  'Rubin Museum of Art': ['https://rubinmuseum.org', 'https://www.rubinmuseum.org'],
  'Astoria Flea & Food': ['https://astoriaflea.com', 'https://www.astoriaflea.com'],
}

async function run() {
  console.log('🔄 Fixing missing images with alternative URL strategies…\n')

  const entities = await prisma.entity.findMany({
    where: {
      website: { not: { contains: 'example.com' } },
      media: {
        some: {
          is_primary: true,
          source_url: { contains: 'unsplash' },
        },
      },
    },
    select: {
      id: true,
      canonical_name: true,
      website: true,
      media: { where: { is_primary: true }, select: { id: true }, take: 1 },
    },
  })

  console.log(`Found ${entities.length} entities still using placeholder images.\n`)

  let updated = 0
  let failed = 0

  for (const entity of entities) {
    const altUrls = ALTERNATIVE_URLS[entity.canonical_name] ?? [entity.website!]
    const imageUrl = await getBestImage(altUrls)

    if (!imageUrl || imageUrl.includes('unsplash')) {
      console.log(`  ⚠️  ${entity.canonical_name} — still no image`)
      failed++
    } else {
      const mediaId = entity.media[0]?.id
      if (mediaId) {
        await prisma.media.update({
          where: { id: mediaId },
          data: { source_url: imageUrl, thumbnail_url: imageUrl, source_platform: 'direct', rights_status: 'linked' },
        })
      }
      console.log(`  ✅  ${entity.canonical_name}`)
      updated++
    }

    await sleep(300)
  }

  console.log(`\n✨ Done — ${updated} updated, ${failed} still missing.\n`)
  await prisma.$disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
