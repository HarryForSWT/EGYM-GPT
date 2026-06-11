import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <main className="page-content">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
