'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface SimilarItem {
  entity_id: string
  name: string
  type: string
  neighborhood: string | null
  tags: string[]
  start_time: string | null
  ticket_url: string | null
  price: string | null
  media_url: string | null
  reason: string
}

interface SimilarResponse {
  source: { id: string; name: string; type: string; neighborhood: string | null }
  similar: SimilarItem[]
}

export default function SimilarList({ entityId }: { entityId: string }) {
  const [data, setData] = useState<SimilarResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    fetch(`/api/similar?entity_id=${encodeURIComponent(entityId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d) => alive && setData(d))
      .catch(() => alive && setError('Could not load similar events right now.'))
    return () => { alive = false }
  }, [entityId])

  return (
    <section className="border border-[#2a2a2a] rounded-2xl p-5 bg-[#131313]">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-[#ff4757]" />
        <h2 className="font-bold">
          {data ? `Because you liked ${data.source.name}` : 'More like this'}
        </h2>
      </div>

      {!data && !error && (
        <p className="text-sm text-gray-500 animate-pulse py-4">
          Reading the whole calendar to find true matches — vibe, format, crowd — not just matching labels…
        </p>
      )}
      {error && <p className="text-sm text-gray-500 py-4">{error}</p>}

      {data && data.similar.length === 0 && (
        <p className="text-sm text-gray-500 py-4">Nothing close enough on the calendar right now.</p>
      )}

      <div className="space-y-3 mt-3">
        {data?.similar.map((s) => (
          <div key={s.entity_id} className="flex gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]">
            {s.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.media_url}
                alt=""
                className="w-14 h-14 rounded-lg object-cover shrink-0 bg-[#222]"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{s.name}</div>
              <div className="text-xs text-gray-500 mb-1">
                {[
                  s.neighborhood,
                  s.start_time &&
                    new Date(s.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                  s.price,
                ].filter(Boolean).join(' · ')}
              </div>
              <div className="text-xs text-gray-400 leading-snug">{s.reason}</div>
              {s.ticket_url && (
                <a
                  href={s.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-[#ff4757] font-semibold mt-1"
                >
                  Tickets ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
