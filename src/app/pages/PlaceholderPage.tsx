import './pages.css'

interface PlaceholderPageProps {
  readonly description: string
  readonly title: string
}

export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  const titleId = `${title.toLowerCase()}-title`

  return (
    <section className="page" aria-labelledby={titleId}>
      <header className="page-header">
        <p className="page-eyebrow">Workspace</p>
        <h1 id={titleId}>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="empty-panel">
        <p className="empty-panel__status">Planned feature</p>
        <p>This surface will be implemented in its dedicated roadmap milestone.</p>
      </div>
    </section>
  )
}
