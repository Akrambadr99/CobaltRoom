import { useMemo, useState, type SyntheticEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { ProjectStatus } from '../../domain'
import { ProjectCreateDialog } from '../../features/projects/ProjectCreateDialog'
import { useProjectSummaries } from '../../features/projects/project-queries'
import {
  isProjectStatus,
  parseProjectWorkspaceState,
  serializeProjectWorkspaceState,
  type ProjectWorkspaceState,
} from '../../features/projects/project-workspace-state'
import { useAuthorization } from '../providers/authorization-context'
import './pages.css'

const projectStatuses: readonly ProjectStatus[] = [
  'planned',
  'active',
  'paused',
  'completed',
  'archived',
]

export function ProjectsPage() {
  const authorization = useAuthorization()
  const [parameters, setParameters] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const state = useMemo(
    () => parseProjectWorkspaceState(parameters),
    [parameters],
  )
  const projects = useProjectSummaries(state)

  const updateState = (changes: Partial<ProjectWorkspaceState>): void => {
    setParameters(
      serializeProjectWorkspaceState({
        ...state,
        ...changes,
        page: changes.page ?? 1,
      }),
    )
  }

  const handleSearch = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('search')
    updateState({
      search: typeof value === 'string' ? value.trim().slice(0, 100) : '',
    })
  }

  return (
    <section className="page" aria-labelledby="projects-title">
      <ProjectsHeader
        count={projects.data?.totalItems}
        canCreate={authorization.can('project:create')}
        onCreate={() => {
          setCreateOpen(true)
        }}
      />
      <form className="project-filters" role="search" onSubmit={handleSearch}>
        <label>
          <span>Search projects</span>
          <input
            key={state.search}
            name="search"
            type="search"
            maxLength={100}
            defaultValue={state.search}
            placeholder="Name, key, or description"
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={state.status ?? ''}
            onChange={(event) => {
              updateState({
                status: isProjectStatus(event.currentTarget.value)
                  ? event.currentTarget.value
                  : null,
              })
            }}
          >
            <option value="">All statuses</option>
            {projectStatuses.map((status) => (
              <option key={status} value={status}>
                {formatProjectStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="submit">
          Search
        </button>
      </form>

      {projects.isPending ? (
        <div className="dashboard-state" role="status" aria-live="polite">
          Loading projects…
        </div>
      ) : projects.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Projects are unavailable</h2>
          <p>The local service could not load this workspace’s projects.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void projects.refetch()}
          >
            Retry projects
          </button>
        </div>
      ) : projects.data.items.length === 0 ? (
        <div className="empty-panel">
          <p className="empty-panel__status">
            {projects.data.totalItems > 0 ? 'Page out of range' : 'No matching projects'}
          </p>
          <p>
            {projects.data.totalItems > 0
              ? 'The requested page no longer exists for this project set.'
              : 'Try removing a status filter or using a broader search term.'}
          </p>
          {projects.data.totalItems > 0 ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                updateState({ page: 1 })
              }}
            >
              Return to first page
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="project-grid" aria-label="Workspace projects">
            {projects.data.items.map((summary) => (
              <li key={summary.project.id}>
                <article className="project-card">
                  <header className="project-card__header">
                    <span className="project-card__key">{summary.project.key}</span>
                    <span className="project-card__status">
                      Status: {formatProjectStatus(summary.project.status)}
                    </span>
                  </header>
                  <div>
                    <h2>
                      <Link
                        className="project-card__link"
                        to={`/projects/${summary.project.id}`}
                      >
                        {summary.project.name}
                      </Link>
                    </h2>
                    <p>{summary.project.description}</p>
                  </div>
                  <dl className="project-card__metrics">
                    <div>
                      <dt>Open</dt>
                      <dd>{summary.openIssues}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{summary.completedIssues}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{summary.totalIssues}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
          <nav className="project-pagination" aria-label="Projects pagination">
            <button
              className="secondary-button"
              type="button"
              disabled={projects.data.pageNumber <= 1}
              onClick={() => {
                updateState({ page: projects.data.pageNumber - 1 })
              }}
            >
              Previous
            </button>
            <p aria-live="polite">
              Page {projects.data.pageNumber} of {Math.max(projects.data.pageCount, 1)}
            </p>
            <button
              className="secondary-button"
              type="button"
              disabled={projects.data.pageNumber >= projects.data.pageCount}
              onClick={() => {
                updateState({ page: projects.data.pageNumber + 1 })
              }}
            >
              Next
            </button>
          </nav>
        </>
      )}
      {createOpen ? (
        <ProjectCreateDialog
          onClose={() => {
            setCreateOpen(false)
          }}
        />
      ) : null}
    </section>
  )
}

function ProjectsHeader({
  count,
  canCreate,
  onCreate,
}: Readonly<{
  count: number | undefined
  canCreate: boolean
  onCreate: () => void
}>) {
  return (
    <header className="page-header projects-header">
      <div>
        <p className="page-eyebrow">Workspace portfolio</p>
        <h1 id="projects-title">Projects</h1>
        <p>Review active initiatives, operating context, and tracked work.</p>
      </div>
      <div className="projects-header__actions">
        {count !== undefined ? (
          <p className="projects-header__count" aria-live="polite">
            {count} matching {count === 1 ? 'project' : 'projects'}
          </p>
        ) : null}
        {canCreate ? (
          <button className="primary-button" type="button" onClick={onCreate}>
            Create project
          </button>
        ) : null}
      </div>
    </header>
  )
}

function formatProjectStatus(status: ProjectStatus): string {
  return `${status[0]?.toLocaleUpperCase() ?? ''}${status.slice(1)}`
}
