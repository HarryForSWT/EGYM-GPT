export default function AnalysePage() {
  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">Analyse</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Dein Fortschritt auf einen Blick</p>
        </div>
      </header>

      <div className="px-4">
        <div className="card text-center py-4">
          <div className="text-muted mb-2">Hier entstehen deine Diagramme</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Sobald du Daten im Training erfasst, siehst du hier deine Kraftentwicklung über die Zeit.
          </p>
        </div>
      </div>
    </div>
  )
}
