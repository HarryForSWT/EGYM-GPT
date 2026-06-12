'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Dumbbell, User } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'

export default function BottomNav() {
  const pathname = usePathname()
  const { lang } = useLang()

  const navItems = [
    { href: '/',         label: t(lang, 'navHome'),     icon: Home },
    { href: '/training', label: t(lang, 'navTraining'), icon: Dumbbell },
    { href: '/analyse',  label: t(lang, 'navAnalyse'),  icon: BarChart2 },
    { href: '/profil',   label: t(lang, 'navProfil'),   icon: User },
  ]

  return (
    <nav className="bottom-nav" role="navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
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
