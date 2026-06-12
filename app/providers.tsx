'use client'

import { LangProvider } from '@/lib/LanguageContext'
import { type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>
}
