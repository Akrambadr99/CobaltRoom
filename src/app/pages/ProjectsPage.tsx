import { Link } from 'react-router-dom'

import { useProjectsIndexData } from '../../features/projects/project-queries'
import type { ProjectStatus } from '../../domain'
import './pages.css'

export function ProjectsPage() {
  const { issues, projects } = useProjectsIndexData()

  if (issues.isPending || projects.isPending) {
    return (
      <section className="page" aria-labelledby="projects-title" aria-busy="true">
        <ProjectsHeader />
        <div className="dashboard-state" role="status">
          Loading projects…
        </div>
      </section>
    )
  }

  if (issues.isError || projects.isError) {
    return (
      <section className="page" aria-labelledby="projects-title">
        <ProjectsHeader />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Projects are unavailable</h2>
          <p>The local service could not load this workspace’s projects.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void Promise.all([issues.refetch(), projects.refetch()])
            }}
          >
            Retry projects
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="page" aria-labelledby="projects-title">
      <ProjectsHeader />
      <ul className="project-grid" aria-label="Workspace projects">
        {projects.data.map((project) => {
          const issueCount = issues.data.filter(
            ({ projectId }) => projectId === project.id,
          ).length

          return (
            <li key={project.id}>
              <article className="project-card">
                <header className="project-card__header">
                  <span className="project-card__key">{project.key}</span>
                  <span className="project-card__status">
                    Status: {formatProjectStatus(project.status)}
                  </span>
                </header>
                <div>
                  <h2>
                    <Link
                      className="project-card__link"
                      to={`/projects/${project.id}`}
                    >
                      {project.name}
                    </Link>
                  </h2>
                  <p>{project.description}</p>
                </div>
                <p className="project-card__count">
                  {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
                </p>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ProjectsHeader() {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace portfolio</p>
      <h1 id="projects-title">Projects</h1>
      <p>Review active initiatives, operating context, and tracked work.</p>
    </header>
  )
}

function formatProjectStatus(status: ProjectStatus): string {
  return `${status[0]?.toLocaleUpperCase() ?? ''}${status.slice(1)}`
}
