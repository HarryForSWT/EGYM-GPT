'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getStoredLang, setStoredLang, type Lang } from '@/lib/i18n'

type LangContextValue = {
  lang: Lang
  setLang: (l: Lang) => void
}

const LangContext = createContext<LangContextValue>({ lang: 'de', setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')

  useEffect(() => {
    setLangState(getStoredLang())
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    setStoredLang(l)
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}
