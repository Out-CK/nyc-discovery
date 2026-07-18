'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Bookmark, Settings, Map } from 'lucide-react'

export default function NavBar() {
  const path = usePathname()

  const links = [
    { href: '/feed', icon: Compass, label: 'Discover' },
    { href: '/saved', icon: Bookmark, label: 'Saved' },
  ]

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a] bg-[#0f0f0f]/90 backdrop-blur-sm sticky top-0 z-40">
      <Link href="/feed" className="flex items-center gap-2 font-black text-lg tracking-tight">
        <span className="text-2xl">🗽</span>
        <span>NYC</span>
        <span className="text-[#ff4757]">Discovery</span>
      </Link>

      <div className="flex items-center gap-1">
        <a
          href="/map/"
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors"
          style={{ color: '#6b7280' }}
        >
          <Map size={16} />
          Map
        </a>
        {links.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors"
              style={{
                background: active ? 'rgba(255, 71, 87, 0.15)' : 'transparent',
                color: active ? '#ff4757' : '#6b7280',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          <Settings size={16} />
          Admin
        </Link>
      </div>
    </nav>
  )
}
