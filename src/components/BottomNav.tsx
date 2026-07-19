'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, Compass, UserRound } from 'lucide-react'

const TABS = [
  { href: '/map/', icon: Map, label: 'Map', external: true },
  { href: '/feed', icon: Compass, label: 'Discovery' },
  { href: '/you', icon: UserRound, label: 'You' },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex items-stretch bg-[#0f0f0f]/95 backdrop-blur-sm border-t border-[#2a2a2a]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ href, icon: Icon, label, external }) => {
        const active = !external && path.startsWith(href)
        const cls = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors'
        const style = { color: active ? '#ff4757' : '#6b7280' }
        return external ? (
          <a key={href} href={href} className={cls} style={style}>
            <Icon size={20} />
            {label}
          </a>
        ) : (
          <Link key={href} href={href} className={cls} style={style}>
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
