'use client'

import { useState, useEffect } from 'react'
import NavBar from '@/components/NavBar'
import Link from 'next/link'
import { Trash2, ExternalLink, MapPin, Clock } from 'lucide-react'

interface SavedEntity {
  id: string
  canonical_name: string
  entity_type: string
  short_description: string | null
  neighborhood: string | null
  address: string | null
  website: string | null
  media: Array<{ source_url: string; thumbnail_url: string | null; media_type: string }>
  reviews: { avg_rating: number | null; review_count: number } | null
  occurrences: Array<{ start_time: string | null; title: string }>
}

interface SavedItem {
  id: string
  folder: string
  saved_at: string
  entity: SavedEntity
}

const FOLDERS = [
  { key: 'all', label: 'All Saved' },
  { key: 'restaurants', label: '🍽️ Restaurants' },
  { key: 'classes', label: '🎨 Classes' },
  { key: 'shows', label: '🎭 Shows' },
  { key: 'events', label: '🎉 Events' },
  { key: 'general', label: '📌 General' },
]

function getPrimaryImage(media: SavedEntity['media']): string | null {
  const img = media.find(m => m.media_type === 'image' || m.thumbnail_url)
  return img?.thumbnail_url ?? img?.source_url ?? null
}

const TYPE_EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  class: '🎨',
  show: '🎭',
  concert: '🎵',
  fitness: '💪',
  exhibit: '🖼️',
  market: '🛍️',
  party: '🎉',
  other: '✨',
}

export default function SavedPage() {
  const [items, setItems] = useState<SavedItem[]>([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const url = activeFolder === 'all' ? '/api/saved' : `/api/saved?folder=${activeFolder}`
      const res = await fetch(url)
      const data = await res.json()
      setItems(data.items ?? [])
      setLoading(false)
    }
    load()
  }, [activeFolder])

  const handleRemove = async (entityId: string) => {
    await fetch('/api/saved', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entityId }),
    })
    setItems(prev => prev.filter(i => i.entity.id !== entityId))
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Saved Places</h1>

        {/* Folder tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          {FOLDERS.map(({ key, label }) => (
            <button
              key={key}
              className="px-4 py-2 rounded-full text-sm transition-all border"
              style={{
                background: activeFolder === key ? '#ff4757' : 'transparent',
                borderColor: activeFolder === key ? '#ff4757' : '#3a3a3a',
                color: activeFolder === key ? '#fff' : '#9ca3af',
              }}
              onClick={() => setActiveFolder(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-16 animate-pulse">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📌</div>
            <h2 className="text-xl font-semibold mb-2">Nothing saved yet</h2>
            <p className="text-gray-500 mb-6">Swipe right on anything that catches your eye.</p>
            <Link
              href="/feed"
              className="px-6 py-3 bg-[#ff4757] text-white rounded-full font-medium hover:bg-[#ff6b78] transition-colors"
            >
              Start discovering
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => {
              const entity = item.entity
              const img = getPrimaryImage(entity.media)
              const nextEvent = entity.occurrences?.[0]
              return (
                <div
                  key={item.id}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl overflow-hidden hover:border-[#3a3a3a] transition-colors group"
                >
                  {/* Image */}
                  <div className="relative h-40 bg-[#0f0f0f]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={entity.canonical_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {TYPE_EMOJI[entity.entity_type] ?? '✨'}
                      </div>
                    )}
                    <button
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900"
                      onClick={() => handleRemove(entity.id)}
                    >
                      <Trash2 size={14} className="text-gray-300" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Link
                        href={`/entity/${entity.id}`}
                        className="font-semibold hover:text-[#ff4757] transition-colors line-clamp-1"
                      >
                        {entity.canonical_name}
                      </Link>
                      {entity.reviews?.avg_rating && (
                        <span className="text-yellow-400 text-sm shrink-0">★ {entity.reviews.avg_rating.toFixed(1)}</span>
                      )}
                    </div>

                    {entity.short_description && (
                      <p className="text-gray-400 text-sm line-clamp-2 mb-3">{entity.short_description}</p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {entity.neighborhood && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {entity.neighborhood}
                        </span>
                      )}
                      {nextEvent?.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {new Date(nextEvent.start_time).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#2a2a2a]">
                      <Link
                        href={`/entity/${entity.id}`}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        View details
                      </Link>
                      {entity.website && (
                        <a
                          href={entity.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                        >
                          <ExternalLink size={11} /> Visit site
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
