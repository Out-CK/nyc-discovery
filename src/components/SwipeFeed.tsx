'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { Heart, X, Bookmark, Info, MapPin, Clock, DollarSign, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Media {
  id: string
  source_url: string
  thumbnail_url: string | null
  media_type: string
  source_platform: string
  alt_text: string | null
}

interface Occurrence {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  ticket_url: string | null
  price: string | null
  event_status: string
}

interface Entity {
  id: string
  canonical_name: string
  entity_type: string
  short_description: string | null
  neighborhood: string | null
  borough: string | null
  address: string | null
  price_level: number | null
  tags: string
  website: string | null
  media: Media[]
  reviews: {
    avg_rating: number | null
    review_count: number
    review_summary: string | null
    sentiment_score: number | null
  } | null
}

interface Post {
  id: string
  headline: string
  subheadline: string | null
  body_markdown: string | null
  cta_label: string
  cta_url: string | null
  entity_id: string
  entity: Entity
  occurrence: Occurrence | null
}

interface SwipeFeedProps {
  sessionId: string
}

type SwipeDirection = 'left' | 'right' | null

const TYPE_COLORS: Record<string, string> = {
  restaurant: '#ff6b35',
  class: '#4ecdc4',
  show: '#a855f7',
  concert: '#ec4899',
  party: '#f59e0b',
  exhibit: '#06b6d4',
  market: '#84cc16',
  fitness: '#22d3ee',
  other: '#6b7280',
}

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  class: 'Class',
  show: 'Show',
  concert: 'Concert',
  party: 'Party',
  exhibit: 'Exhibit',
  market: 'Market',
  fitness: 'Fitness',
  other: 'Experience',
}

function parseTagsArray(tags: string): string[] {
  try { return JSON.parse(tags) } catch { return [] }
}

function formatPriceLevel(level: number | null): string {
  if (!level) return ''
  return '$'.repeat(level)
}

function formatDate(dt: string | null): string {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function getPrimaryImage(media: Media[]): string | null {
  const imgs = media.filter(m => m.media_type === 'image' || m.thumbnail_url)
  if (imgs.length === 0) return null
  const primary = imgs.find(m => m.source_url)
  return primary?.thumbnail_url || primary?.source_url || null
}

// ─── Individual Swipe Card ────────────────────────────────────────────────────

function SwipeCard({
  post,
  onSwipe,
  isTop,
  zIndex,
}: {
  post: Post
  onSwipe: (dir: SwipeDirection, post: Post) => void
  isTop: boolean
  zIndex: number
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 0, 300], [-20, 0, 20])
  const rightOpacity = useTransform(x, [50, 150], [0, 1])
  const leftOpacity = useTransform(x, [-150, -50], [1, 0])
  const [mediaIndex, setMediaIndex] = useState(0)
  const [showDetail, setShowDetail] = useState(false)

  const entity = post.entity
  const media = entity.media
  const tags = parseTagsArray(entity.tags)
  const typeColor = TYPE_COLORS[entity.entity_type] ?? '#6b7280'
  const typeLabel = TYPE_LABELS[entity.entity_type] ?? 'Experience'
  const primaryImage = getPrimaryImage(media)
  const allImages = media.filter(m => m.media_type === 'image' || m.thumbnail_url)

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x > 120) {
        onSwipe('right', post)
      } else if (info.offset.x < -120) {
        onSwipe('left', post)
      }
    },
    [onSwipe, post]
  )

  return (
    <motion.div
      className="absolute inset-0 swipe-card"
      style={{ x, rotate, zIndex }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: 'grabbing' }}
    >
      {/* Swipe indicators */}
      {isTop && (
        <>
          <motion.div
            className="absolute top-8 left-8 z-20 border-4 border-[#2ed573] rounded-xl px-4 py-2"
            style={{ opacity: rightOpacity }}
          >
            <span className="text-[#2ed573] font-black text-2xl tracking-wider">SAVE</span>
          </motion.div>
          <motion.div
            className="absolute top-8 right-8 z-20 border-4 border-[#ff4757] rounded-xl px-4 py-2"
            style={{ opacity: leftOpacity }}
          >
            <span className="text-[#ff4757] font-black text-2xl tracking-wider">NOPE</span>
          </motion.div>
        </>
      )}

      <div className="w-full h-full rounded-2xl overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] flex flex-col select-none">
        {/* Image Area */}
        <div className="relative flex-shrink-0" style={{ height: '52%' }}>
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt={entity.canonical_name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-6xl"
              style={{ background: `${typeColor}22` }}
            >
              {entity.entity_type === 'restaurant' ? '🍽️' :
               entity.entity_type === 'class' ? '🎨' :
               entity.entity_type === 'show' ? '🎭' :
               entity.entity_type === 'concert' ? '🎵' :
               entity.entity_type === 'fitness' ? '💪' : '✨'}
            </div>
          )}

          {/* Image nav dots */}
          {allImages.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {allImages.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i === mediaIndex ? '#fff' : 'rgba(255,255,255,0.4)' }}
                  onClick={() => setMediaIndex(i)}
                />
              ))}
            </div>
          )}

          {/* Platform attribution */}
          {media[0]?.source_platform && (
            <div className="absolute top-3 right-3 bg-black/60 rounded-full px-2 py-0.5 text-xs text-gray-300">
              via {media[0].source_platform}
            </div>
          )}

          {/* Type badge */}
          <div
            className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ background: typeColor }}
          >
            {typeLabel}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col p-5 gap-2 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold leading-tight line-clamp-2 flex-1">
              {post.headline}
            </h2>
            {entity.reviews?.avg_rating && (
              <div className="flex items-center gap-1 text-yellow-400 text-sm font-semibold shrink-0">
                ★ {entity.reviews.avg_rating.toFixed(1)}
              </div>
            )}
          </div>

          {post.subheadline && (
            <p className="text-gray-400 text-sm line-clamp-2">{post.subheadline}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
            {entity.neighborhood && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {entity.neighborhood}
              </span>
            )}
            {entity.price_level && (
              <span className="flex items-center gap-1">
                <DollarSign size={11} /> {formatPriceLevel(entity.price_level)}
              </span>
            )}
            {post.occurrence?.start_time && (
              <span className="flex items-center gap-1">
                <Clock size={11} /> {formatDate(post.occurrence.start_time)}
              </span>
            )}
            {post.occurrence?.price && (
              <span className="flex items-center gap-1">
                <DollarSign size={11} /> {post.occurrence.price}
              </span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="text-xs rounded-full px-2 py-0.5 bg-white/10 text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Reviews snippet */}
          {entity.reviews?.review_summary && (
            <p className="text-xs text-gray-500 italic line-clamp-2 mt-auto">
              &ldquo;{entity.reviews.review_summary}&rdquo;
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a]">
            <Link
              href={`/entity/${entity.id}`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={13} /> Learn more
            </Link>
            {(post.cta_url || entity.website) && (
              <a
                href={post.cta_url ?? entity.website ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={13} /> Visit site
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Swipe Feed ────────────────────────────────────────────────────────────────

export default function SwipeFeed({ sessionId }: SwipeFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [lastAction, setLastAction] = useState<{ dir: SwipeDirection; name: string } | null>(null)
  const [animating, setAnimating] = useState(false)

  const fetchFeed = useCallback(async (p: number) => {
    const res = await fetch(`/api/feed?page=${p}&session=${sessionId}`)
    const data = await res.json()
    return data.posts as Post[]
  }, [sessionId])

  useEffect(() => {
    fetchFeed(0).then(p => {
      setPosts(p)
      setLoading(false)
    })
  }, [fetchFeed])

  // Pre-fetch next page when near end
  useEffect(() => {
    if (posts.length - currentIndex <= 5 && !loading) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchFeed(nextPage).then(newPosts => {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const fresh = newPosts.filter(p => !existingIds.has(p.id))
          return [...prev, ...fresh]
        })
      })
    }
  }, [currentIndex, posts.length, loading, page, fetchFeed])

  const logInteraction = useCallback(
    async (action: string, post: Post) => {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: post.entity_id,
          post_id: post.id,
          occurrence_id: post.occurrence?.id ?? null,
          action,
          session_id: sessionId,
        }),
      })
    },
    [sessionId]
  )

  const handleSwipe = useCallback(
    async (dir: SwipeDirection, post: Post) => {
      if (animating) return
      setAnimating(true)
      setLastAction({ dir, name: post.entity.canonical_name })

      await logInteraction(dir === 'right' ? 'swipe_right' : 'swipe_left', post)

      setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setAnimating(false)
        setTimeout(() => setLastAction(null), 1500)
      }, 300)
    },
    [animating, logInteraction]
  )

  const handleButtonSwipe = (dir: SwipeDirection) => {
    const post = visiblePosts[0]
    if (post) handleSwipe(dir, post)
  }

  const visiblePosts = posts.slice(currentIndex, currentIndex + 3)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-lg animate-pulse">Loading your feed…</div>
      </div>
    )
  }

  if (visiblePosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold">You&apos;ve seen everything!</h2>
        <p className="text-gray-400">Check back later for new recommendations.</p>
        <button
          className="mt-4 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm"
          onClick={() => { setCurrentIndex(0); setPage(0) }}
        >
          Start over
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toast notification */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              background: lastAction.dir === 'right' ? '#2ed573' : '#ff4757',
              color: '#fff',
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {lastAction.dir === 'right' ? <Heart size={14} /> : <X size={14} />}
            {lastAction.dir === 'right' ? 'Saved!' : 'Skipped'} &mdash; {lastAction.name}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card stack */}
      <div className="relative flex-1 mx-auto w-full max-w-md">
        <AnimatePresence>
          {visiblePosts.map((post, i) => (
            <motion.div
              key={post.id}
              className="absolute inset-4"
              style={{
                scale: 1 - i * 0.04,
                y: i * 10,
                zIndex: visiblePosts.length - i,
              }}
              initial={i === 0 ? { scale: 1.05, opacity: 0 } : false}
              animate={{ scale: 1 - i * 0.04, y: i * 10, opacity: 1 }}
              exit={{
                x: lastAction?.dir === 'right' ? 500 : -500,
                rotate: lastAction?.dir === 'right' ? 20 : -20,
                opacity: 0,
                transition: { duration: 0.3 },
              }}
            >
              <SwipeCard
                post={post}
                onSwipe={handleSwipe}
                isTop={i === 0}
                zIndex={visiblePosts.length - i}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8 py-6">
        <button
          className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#ff4757] flex items-center justify-center hover:bg-[#ff4757]/20 transition-colors active:scale-95"
          onClick={() => handleButtonSwipe('left')}
          title="Skip"
        >
          <X size={28} className="text-[#ff4757]" />
        </button>

        <button
          className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-gray-600 flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95"
          onClick={() => {
            const post = visiblePosts[0]
            if (post) logInteraction('save', post)
          }}
          title="Bookmark"
        >
          <Bookmark size={20} className="text-gray-400" />
        </button>

        <button
          className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#2ed573] flex items-center justify-center hover:bg-[#2ed573]/20 transition-colors active:scale-95"
          onClick={() => handleButtonSwipe('right')}
          title="Save"
        >
          <Heart size={28} className="text-[#2ed573]" />
        </button>
      </div>

      {/* Counter */}
      <div className="text-center text-xs text-gray-600 pb-3">
        {currentIndex + 1} of {posts.length} · {visiblePosts.length} more loading
      </div>
    </div>
  )
}
