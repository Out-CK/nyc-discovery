import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import SimilarList from '@/components/SimilarList'
import { parseJSON } from '@/lib/utils'
import { getForecast, weatherEmoji, isRainyDay, isNiceDay } from '@/lib/weather'

const SESSION_COOKIE = 'nyc_session'

export const metadata = { title: 'You – NYC Discovery' }

const LIKE_ACTIONS = ['swipe_right', 'save', 'open_details']

function topN(counts: Record<string, number>, n: number): [string, number][] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

export default async function YouPage({
  searchParams,
}: {
  searchParams: Promise<{ similar?: string }>
}) {
  const { similar } = await searchParams

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = token
    ? await prisma.user.findUnique({
        where: { session_token: token },
        include: { preferences: true },
      })
    : null
  if (!user) redirect('/onboarding')

  const interactions = await prisma.userInteraction.findMany({
    where: { user_id: user.id, action: { in: [...LIKE_ACTIONS, 'swipe_left'] } },
    orderBy: { timestamp: 'desc' },
    take: 500,
    include: { entity: { select: { tags: true, entity_type: true, neighborhood: true } } },
  })

  const likes = interactions.filter((i) => LIKE_ACTIONS.includes(i.action))
  const nopes = interactions.filter((i) => i.action === 'swipe_left')

  const tagCounts: Record<string, number> = {}
  const typeCounts: Record<string, number> = {}
  const hoodCounts: Record<string, number> = {}
  for (const like of likes) {
    if (!like.entity) continue
    for (const t of parseJSON<string[]>(like.entity.tags, [])) {
      if (t === 'Indoor' || t === 'Outdoor') continue
      tagCounts[t] = (tagCounts[t] ?? 0) + 1
    }
    typeCounts[like.entity.entity_type] = (typeCounts[like.entity.entity_type] ?? 0) + 1
    if (like.entity.neighborhood) {
      hoodCounts[like.entity.neighborhood] = (hoodCounts[like.entity.neighborhood] ?? 0) + 1
    }
  }
  // Seed with onboarding picks so new users see something
  for (const t of parseJSON<string[]>(user.preferences?.interest_tags ?? '[]', [])) {
    tagCounts[t] = (tagCounts[t] ?? 0) + 1
  }

  const topTags = topN(tagCounts, 8)
  const topTypes = topN(typeCounts, 4)
  const topHoods = topN(hoodCounts, 5)
  const maxTag = topTags[0]?.[1] ?? 1

  const forecast = await getForecast()
  const week = Object.values(forecast).slice(0, 7)

  const typeLabel: Record<string, string> = {
    concert: 'Live music', show: 'Shows & comedy', exhibit: 'Art',
    class: 'Classes', market: 'Food & markets', restaurant: 'Restaurants',
    fitness: 'Fitness', party: 'Parties', other: 'Other',
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">

        {similar ? (
          <SimilarList entityId={similar} />
        ) : null}

        <section>
          <h1 className="text-2xl font-black mb-1">Your taste</h1>
          <p className="text-sm text-gray-500 mb-6">
            Built from {likes.length} likes and {nopes.length} passes. Every swipe sharpens it.
          </p>

          {likes.length === 0 && topTags.length === 0 ? (
            <div className="text-gray-400 text-sm border border-[#2a2a2a] rounded-2xl p-6">
              Nothing here yet — go swipe in{' '}
              <a href="/feed" className="text-[#ff4757] font-semibold">Discover</a>{' '}
              and your taste profile will take shape.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  What you're into
                </div>
                <div className="space-y-2">
                  {topTags.map(([tag, n]) => (
                    <div key={tag} className="flex items-center gap-3">
                      <div className="w-32 text-sm text-gray-300 truncate">{tag}</div>
                      <div className="flex-1 h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#ff4757]"
                          style={{ width: `${Math.max(8, (n / maxTag) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {topTypes.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Your scene
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topTypes.map(([t, n]) => (
                      <span key={t} className="px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm">
                        {typeLabel[t] ?? t} <span className="text-gray-500">×{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {topHoods.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Your neighborhoods
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topHoods.map(([h, n]) => (
                      <span key={h} className="px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm">
                        📍 {h} <span className="text-gray-500">×{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {week.length > 0 && (
          <section>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              The week ahead
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {week.map((f) => {
                const day = new Date(f.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
                return (
                  <div key={f.date} className="flex flex-col items-center min-w-[64px] px-3 py-3 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]">
                    <div className="text-xs text-gray-500">{day}</div>
                    <div className="text-xl my-1">{weatherEmoji(f)}</div>
                    <div className="text-xs text-gray-300">{f.tempMax}°</div>
                    {f.precipProb >= 35 && (
                      <div className="text-[10px] text-blue-400">{f.precipProb}%</div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {week.some(isRainyDay)
                ? 'Rain coming — your deck is quietly favoring indoor plans on wet days.'
                : week.some(isNiceDay)
                  ? 'Nice days ahead — outdoor events get a boost in your deck.'
                  : 'Your deck factors this forecast into what it deals you.'}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
