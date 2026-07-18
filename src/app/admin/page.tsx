'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart3, Database, Users, ArrowLeft, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react'

interface Stats {
  entityCount: number
  postCount: number
  userCount: number
  interactionCount: number
  savedCount: number
  entityByType: Array<{ entity_type: string; _count: { id: number } }>
  swipes: Array<{ action: string; _count: { id: number } }>
  recentInteractions: Array<{ action: string; timestamp: string; entity: { canonical_name: string } | null }>
}

interface AdminPost {
  id: string
  entity_id: string
  headline: string
  is_active: boolean
  boost_score: number
  quality_score: number
  entity: { canonical_name: string; entity_type: string; neighborhood: string | null }
  occurrence: { title: string; start_time: string | null; event_status: string } | null
  _count: { interactions: number }
}

interface AdminEntity {
  id: string
  canonical_name: string
  entity_type: string
  neighborhood: string | null
  source_confidence: number
  metadata_completeness: number
  claim_status: string
  _count: { media: number; posts: number; interactions: number }
  reviews: { avg_rating: number | null; review_count: number } | null
}

type Tab = 'stats' | 'posts' | 'entities'

const TYPE_COLORS: Record<string, string> = {
  restaurant: '#ff6b35', class: '#4ecdc4', show: '#a855f7', concert: '#ec4899',
  party: '#f59e0b', exhibit: '#06b6d4', market: '#84cc16', fitness: '#22d3ee', other: '#6b7280',
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [entities, setEntities] = useState<AdminEntity[]>([])
  const [loading, setLoading] = useState(false)
  const [entityPage, setEntityPage] = useState(0)
  const [postPage, setPostPage] = useState(0)
  const [entityTotal, setEntityTotal] = useState(0)
  const [postTotal, setPostTotal] = useState(0)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
  }, [])

  useEffect(() => {
    if (tab === 'posts') {
      setLoading(true)
      fetch(`/api/admin/posts?page=${postPage}`)
        .then(r => r.json())
        .then(d => { setPosts(d.posts); setPostTotal(d.total); setLoading(false) })
    }
  }, [tab, postPage])

  useEffect(() => {
    if (tab === 'entities') {
      setLoading(true)
      fetch(`/api/admin/entities?page=${entityPage}`)
        .then(r => r.json())
        .then(d => { setEntities(d.entities); setEntityTotal(d.total); setLoading(false) })
    }
  }, [tab, entityPage])

  const togglePost = async (id: string, is_active: boolean) => {
    await fetch('/api/admin/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    setPosts(prev => prev.map(p => p.id === id ? { ...p, is_active: !is_active } : p))
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] px-6 py-4 flex items-center gap-4">
        <Link href="/feed" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#2a2a2a] px-6 flex gap-1">
        {([
          { key: 'stats', label: 'Stats', icon: BarChart3 },
          { key: 'posts', label: 'Posts', icon: Database },
          { key: 'entities', label: 'Entities', icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className="flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors"
            style={{
              borderColor: tab === key ? '#ff4757' : 'transparent',
              color: tab === key ? '#ff4757' : '#6b7280',
            }}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats tab */}
        {tab === 'stats' && stats && (
          <div className="flex flex-col gap-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Entities', value: stats.entityCount },
                { label: 'Active Posts', value: stats.postCount },
                { label: 'Users', value: stats.userCount },
                { label: 'Interactions', value: stats.interactionCount },
                { label: 'Saved Items', value: stats.savedCount },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-[#ff4757]">{value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">{label}</div>
                </div>
              ))}
            </div>

            {/* Entities by type */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
              <h3 className="font-semibold mb-4 text-gray-300">Entities by Type</h3>
              <div className="flex flex-wrap gap-3">
                {stats.entityByType.sort((a, b) => b._count.id - a._count.id).map(({ entity_type, _count }) => (
                  <div
                    key={entity_type}
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-sm"
                    style={{ background: `${TYPE_COLORS[entity_type] ?? '#6b7280'}22`, border: `1px solid ${TYPE_COLORS[entity_type] ?? '#6b7280'}44` }}
                  >
                    <span style={{ color: TYPE_COLORS[entity_type] ?? '#6b7280' }} className="font-semibold capitalize">{entity_type}</span>
                    <span className="text-gray-400">{_count.id}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Swipe stats */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
              <h3 className="font-semibold mb-4 text-gray-300">Engagement</h3>
              <div className="flex gap-4 flex-wrap">
                {stats.swipes.map(({ action, _count }) => (
                  <div key={action} className="text-center">
                    <div className="text-2xl font-black" style={{
                      color: action === 'swipe_right' ? '#2ed573' : action === 'swipe_left' ? '#ff4757' : '#f59e0b',
                    }}>
                      {_count.id}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">{action.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5">
              <h3 className="font-semibold mb-4 text-gray-300">Recent Activity</h3>
              <div className="flex flex-col gap-2">
                {stats.recentInteractions.map((int, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="text-xs text-gray-600 w-32 shrink-0">
                      {new Date(int.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="capitalize font-medium" style={{
                      color: int.action === 'swipe_right' ? '#2ed573' : int.action === 'swipe_left' ? '#ff4757' : '#9ca3af',
                    }}>
                      {int.action.replace('_', ' ')}
                    </span>
                    <span className="truncate">{int.entity?.canonical_name ?? 'unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Posts tab */}
        {tab === 'posts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-500 text-sm">{postTotal} posts total</p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a] text-sm disabled:opacity-40"
                  disabled={postPage === 0}
                  onClick={() => setPostPage(p => p - 1)}
                >←</button>
                <span className="px-3 py-1.5 text-sm text-gray-500">Page {postPage + 1}</span>
                <button
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a] text-sm disabled:opacity-40"
                  disabled={(postPage + 1) * 25 >= postTotal}
                  onClick={() => setPostPage(p => p + 1)}
                >→</button>
              </div>
            </div>
            {loading ? (
              <div className="text-gray-500 text-center py-16 animate-pulse">Loading…</div>
            ) : (
              <div className="flex flex-col gap-2">
                {posts.map(post => (
                  <div key={post.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-4">
                    <button
                      className="text-gray-400 hover:text-white transition-colors shrink-0"
                      onClick={() => togglePost(post.id, post.is_active)}
                      title={post.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {post.is_active
                        ? <ToggleRight size={24} className="text-[#2ed573]" />
                        : <ToggleLeft size={24} className="text-gray-600" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{post.headline}</div>
                      <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                        <span style={{ color: TYPE_COLORS[post.entity.entity_type] ?? '#6b7280' }} className="capitalize">{post.entity.entity_type}</span>
                        <span>{post.entity.canonical_name}</span>
                        {post.entity.neighborhood && <span>{post.entity.neighborhood}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-right shrink-0">
                      <div>quality: {post.quality_score.toFixed(2)}</div>
                      <div>boost: {post.boost_score.toFixed(1)}</div>
                      <div>{post._count.interactions} interactions</div>
                    </div>
                    <Link
                      href={`/entity/${post.entity_id ?? ''}`}
                      className="text-gray-500 hover:text-white transition-colors shrink-0"
                    >
                      <ExternalLink size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entities tab */}
        {tab === 'entities' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-500 text-sm">{entityTotal} entities total</p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a] text-sm disabled:opacity-40"
                  disabled={entityPage === 0}
                  onClick={() => setEntityPage(p => p - 1)}
                >←</button>
                <span className="px-3 py-1.5 text-sm text-gray-500">Page {entityPage + 1}</span>
                <button
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a] text-sm disabled:opacity-40"
                  disabled={(entityPage + 1) * 25 >= entityTotal}
                  onClick={() => setEntityPage(p => p + 1)}
                >→</button>
              </div>
            </div>
            {loading ? (
              <div className="text-gray-500 text-center py-16 animate-pulse">Loading…</div>
            ) : (
              <div className="flex flex-col gap-2">
                {entities.map(entity => (
                  <div key={entity.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-4">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: TYPE_COLORS[entity.entity_type] ?? '#6b7280' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{entity.canonical_name}</div>
                      <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                        <span style={{ color: TYPE_COLORS[entity.entity_type] ?? '#6b7280' }} className="capitalize">{entity.entity_type}</span>
                        {entity.neighborhood && <span>{entity.neighborhood}</span>}
                        {entity.reviews?.avg_rating && <span>★ {entity.reviews.avg_rating.toFixed(1)}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-right shrink-0 space-y-0.5">
                      <div>completeness: {(entity.metadata_completeness * 100).toFixed(0)}%</div>
                      <div>{entity._count.media} media · {entity._count.posts} posts</div>
                      <div className="capitalize">{entity.claim_status}</div>
                    </div>
                    <Link
                      href={`/entity/${entity.id}`}
                      className="text-gray-500 hover:text-white transition-colors shrink-0"
                    >
                      <ExternalLink size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
