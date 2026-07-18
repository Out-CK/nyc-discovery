import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { MapPin, Clock, Globe, Phone, Star, DollarSign, ExternalLink, Tag } from 'lucide-react'
import Link from 'next/link'
import ClaimButton from '@/components/ClaimButton'

function parseJSON<T>(s: string, fb: T): T {
  try { return JSON.parse(s) } catch { return fb }
}

function formatHours(hoursJson: string | null): Record<string, string> {
  return hoursJson ? parseJSON(hoursJson, {}) : {}
}

function formatPrice(level: number | null): string {
  return level ? '$'.repeat(level) : ''
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      media: { orderBy: { ranking_score: 'desc' } },
      reviews: true,
      occurrences: {
        where: {
          OR: [{ end_time: null }, { end_time: { gte: new Date() } }],
        },
        orderBy: { start_time: 'asc' },
        take: 10,
      },
      source_records: true,
    },
  })

  if (!entity) notFound()

  const tags = parseJSON<string[]>(entity.tags, [])
  const hours = formatHours(entity.business_hours)
  const sourceUrls = parseJSON<string[]>(entity.source_urls, [])
  const images = entity.media.filter(m => m.media_type === 'image' || m.thumbnail_url)
  const quotes = entity.reviews ? parseJSON<string[]>(entity.reviews.notable_quotes, []) : []
  const sourceBrk = entity.reviews ? parseJSON<Record<string, number>>(entity.reviews.source_breakdown, {}) : {}

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <div className="max-w-3xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 justify-between">
            <div>
              <h1 className="text-3xl font-black mb-1">{entity.canonical_name}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                <span className="capitalize bg-[#2a2a2a] px-3 py-1 rounded-full">{entity.entity_type}</span>
                {entity.neighborhood && (
                  <span className="flex items-center gap-1"><MapPin size={12} /> {entity.neighborhood}, {entity.borough}</span>
                )}
                {entity.price_level && (
                  <span className="flex items-center gap-1"><DollarSign size={12} /> {formatPrice(entity.price_level)}</span>
                )}
                {entity.reviews?.avg_rating && (
                  <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                    <Star size={12} fill="currentColor" /> {entity.reviews.avg_rating.toFixed(1)}
                    <span className="text-gray-500 font-normal">({entity.reviews.review_count} reviews)</span>
                  </span>
                )}
              </div>
            </div>
            <ClaimButton entityId={entity.id} claimStatus={entity.claim_status} />
          </div>
        </div>

        {/* Media gallery */}
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 snap-x">
            {images.map((m, i) => (
              <div key={m.id} className="shrink-0 snap-start rounded-xl overflow-hidden" style={{ width: i === 0 ? 480 : 220, height: 280 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbnail_url ?? m.source_url}
                  alt={m.alt_text ?? entity.canonical_name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* Description */}
            {(entity.full_description || entity.short_description) && (
              <section>
                <h2 className="text-lg font-bold mb-3">About</h2>
                <p className="text-gray-300 leading-relaxed">
                  {entity.full_description ?? entity.short_description}
                </p>
              </section>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Tag size={16} /> Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => (
                    <span key={t} className="text-sm bg-[#2a2a2a] text-gray-300 px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming occurrences */}
            {entity.occurrences.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3">Upcoming</h2>
                <div className="flex flex-col gap-3">
                  {entity.occurrences.map(occ => (
                    <div key={occ.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                      <div className="font-semibold mb-1">{occ.title}</div>
                      <div className="text-sm text-gray-400 flex flex-wrap gap-3">
                        {occ.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(occ.start_time).toLocaleString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                          </span>
                        )}
                        {occ.price && <span>{occ.price}</span>}
                        <span className="capitalize px-2 py-0.5 bg-[#2a2a2a] rounded-full text-xs">{occ.event_status}</span>
                      </div>
                      {occ.ticket_url && (
                        <a
                          href={occ.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm text-[#ff4757] hover:underline"
                        >
                          <ExternalLink size={13} /> Get tickets
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            {entity.reviews && (
              <section>
                <h2 className="text-lg font-bold mb-3">Reviews</h2>
                {entity.reviews.review_summary && (
                  <p className="text-gray-300 italic mb-4">&ldquo;{entity.reviews.review_summary}&rdquo;</p>
                )}
                {quotes.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4">
                    {quotes.slice(0, 3).map((q, i) => (
                      <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-sm text-gray-300 italic">
                        &ldquo;{q}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
                {Object.entries(sourceBrk).length > 0 && (
                  <div className="text-xs text-gray-500">
                    Reviews from: {Object.entries(sourceBrk).map(([src, cnt]) => `${src} (${cnt})`).join(', ')}
                  </div>
                )}
              </section>
            )}

            {/* Source links */}
            {sourceUrls.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3">Links & Sources</h2>
                <div className="flex flex-col gap-2">
                  {sourceUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink size={13} />
                      <span className="truncate">{url}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Contact info */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="font-semibold text-sm text-gray-400">Info</h3>
              {entity.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <span className="text-gray-300">{entity.address}</span>
                </div>
              )}
              {entity.website && (
                <a
                  href={entity.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#ff4757] hover:underline"
                >
                  <Globe size={14} /> Website
                </a>
              )}
              {entity.phone && (
                <a href={`tel:${entity.phone}`} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                  <Phone size={14} /> {entity.phone}
                </a>
              )}
              {entity.instagram_handle && (
                <a
                  href={`https://instagram.com/${entity.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-pink-400 hover:underline"
                >
                  @{entity.instagram_handle} on Instagram
                </a>
              )}
            </div>

            {/* Hours */}
            {Object.keys(hours).length > 0 && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4">
                <h3 className="font-semibold text-sm text-gray-400 mb-3">Hours</h3>
                <div className="flex flex-col gap-1.5">
                  {DAYS.map(day => {
                    const h = hours[day] ?? hours[day.toLowerCase()] ?? '—'
                    return (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-500">{day.slice(0, 3)}</span>
                        <span className="text-gray-300">{h}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2a2a2a] text-xs text-gray-600">
          Entity ID: {entity.id} · Source confidence: {(entity.source_confidence * 100).toFixed(0)}% ·
          Completeness: {(entity.metadata_completeness * 100).toFixed(0)}% ·{' '}
          <Link href="/feed" className="hover:text-gray-400">← Back to feed</Link>
        </div>
      </div>
    </div>
  )
}
