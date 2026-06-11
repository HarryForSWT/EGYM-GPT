'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Dumbbell, User } from 'lucide-react'

const navItems = [
  { href: '/',        label: 'Home',     icon: Home },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/analyse',  label: 'Analyse',  icon: BarChart2 },
  { href: '/profil',   label: 'Profil',   icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Hauptnavigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            id={`nav-${label.toLowerCase()}`}
            className={`nav-item ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
