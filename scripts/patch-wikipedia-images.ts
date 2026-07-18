/**
 * patch-wikipedia-images.ts
 *
 * Uses the Wikipedia page images API to fetch real photos for
 * well-known venues that blocked direct scraping.
 *
 * Run: npx tsx scripts/patch-wikipedia-images.ts
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

// Map entity name → Wikipedia article title
const WIKIPEDIA_TITLES: Record<string, string> = {
  'Carnegie Hall': 'Carnegie Hall',
  'The Public Theater': 'The Public Theater',
  'New Museum': 'New Museum',
  'Museum of the Moving Image': 'Museum of the Moving Image',
  'The Shed': 'The Shed (building)',
  'Rubin Museum of Art': 'Rubin Museum of Art',
  'Angelika Film Center': 'Angelika Film Center',
  'Di Fara Pizza': 'Di Fara Pizza',
  'The Blue Note': 'Blue Note (jazz club)',
  'Avant Gardner / Brooklyn Mirage': 'Avant Gardner',
  'Village Vanguard': 'Village Vanguard',
  'Birdland Jazz Club': 'Birdland (jazz club)',
  'Brooklyn Museum First Saturdays': 'Brooklyn Museum',
  'MoMA PS1 Warm Up': 'MoMA PS1',
  'Comedy Cellar': 'Comedy Cellar',
  'Sleep No More': 'Sleep No More (theater)',
  "Joe's Pizza": "Joe's Pizza",
  'Peter Luger Steak House': 'Peter Luger Steak House',
  'Balthazar': 'Balthazar (restaurant)',
  "L&B Spumoni Gardens": "L&B Spumoni Gardens",
  "Sylvia's Restaurant": "Sylvia's Restaurant",
  'Gramercy Tavern': 'Gramercy Tavern',
  'Minetta Tavern': 'Minetta Tavern',
  'The Metropolitan Museum of Art': 'Metropolitan Museum of Art',
  'MoMA': 'Museum of Modern Art',
  'Whitney Museum of American Art': 'Whitney Museum of American Art',
  'Guggenheim Museum': 'Solomon R. Guggenheim Museum',
  'The Frick Collection': 'Frick Collection',
  'Cooper Hewitt, Smithsonian Design Museum': 'Cooper Hewitt, Smithsonian Design Museum',
  'Wave Hill': 'Wave Hill (garden)',
  'El Museo del Barrio': 'El Museo del Barrio',
  'Socrates Sculpture Park': 'Socrates Sculpture Park',
  'The Noguchi Museum': 'Noguchi Museum',
  'Alvin Ailey Extension': 'Alvin Ailey American Dance Theater',
  'BAM (Brooklyn Academy of Music)': 'Brooklyn Academy of Music',
  'Nuyorican Poets Cafe': 'Nuyorican Poets Cafe',
  'UCB Theatre': 'Upright Citizens Brigade Theatre',
  'Brooklyn Flea': 'Brooklyn Flea',
  'Chelsea Market': 'Chelsea Market',
  'Union Square Greenmarket': 'Union Square Greenmarket',
  "Hell's Kitchen Flea Market": "Hell's Kitchen Flea Market",
  'Essex Market': 'Essex Street Market',
  'Queens Night Market': 'Queens Night Market',
  "Juliana's Pizza": "Grimaldi's Pizzeria",
  'Peter Luger Steak House': 'Peter Luger Steak House',
}

async function getWikipediaImage(title: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=thumbnail&pithumbsize=1200&format=json`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NYCDiscovery/1.0 (educational project)' },
    })
    if (!res.ok) return null
    const data = await res.json() as { query: { pages: Record<string, { thumbnail?: { source: string } }> } }
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0]
    return page?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  console.log('🌐 Fetching Wikipedia images for well-known venues…\n')

  const entities = await prisma.entity.findMany({
    where: {
      canonical_name: { in: Object.keys(WIKIPEDIA_TITLES) },
    },
    select: {
      id: true,
      canonical_name: true,
      media: { where: { is_primary: true }, select: { id: true, source_url: true }, take: 1 },
    },
  })

  let updated = 0
  let failed = 0

  for (const entity of entities) {
    const currentUrl = entity.media[0]?.source_url ?? ''
    const wikTitle = WIKIPEDIA_TITLES[entity.canonical_name]
    if (!wikTitle) continue

    const imageUrl = await getWikipediaImage(wikTitle)
    if (!imageUrl) {
      console.log(`  ⚠️  ${entity.canonical_name} — no Wikipedia image`)
      failed++
    } else {
      const mediaId = entity.media[0]?.id
      if (mediaId) {
        await prisma.media.update({
          where: { id: mediaId },
          data: { source_url: imageUrl, thumbnail_url: imageUrl, source_platform: 'direct', rights_status: 'linked' },
        })
        const wasPlaceholder = currentUrl.includes('unsplash') ? ' (replaced placeholder)' : ''
        console.log(`  ✅  ${entity.canonical_name}${wasPlaceholder}`)
        updated++
      }
    }

    // Be polite to Wikipedia API
    await sleep(100)
  }

  console.log(`\n✨ Done — ${updated} updated, ${failed} failed.\n`)
  await prisma.$disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
