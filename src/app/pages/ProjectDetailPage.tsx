import { Link, useParams } from 'react-router-dom'

import { useProjectsIndexData } from '../../features/projects/project-queries'
import { projectId, type ProjectId } from '../../domain'
import './pages.css'

export function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const requestedProjectId = parseProjectId(params.projectId)

  return requestedProjectId ? (
    <LoadedProject requestedProjectId={requestedProjectId} />
  ) : (
    <ProjectNotFound />
  )
}

function LoadedProject({
  requestedProjectId,
}: Readonly<{ requestedProjectId: ProjectId }>) {
  const { issues, projects } = useProjectsIndexData()

  if (issues.isPending || projects.isPending) {
    return (
      <section className="page" aria-labelledby="project-detail-title" aria-busy="true">
        <ProjectDetailHeader title="Project" />
        <div className="dashboard-state" role="status">
          Loading project…
        </div>
      </section>
    )
  }

  if (issues.isError || projects.isError) {
    return (
      <section className="page" aria-labelledby="project-detail-title">
        <ProjectDetailHeader title="Project" />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Project data is unavailable</h2>
          <p>The local service could not load this project.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void Promise.all([issues.refetch(), projects.refetch()])
            }}
          >
            Retry project
          </button>
        </div>
      </section>
    )
  }

  const project = projects.data.find(({ id }) => id === requestedProjectId)

  if (!project) {
    return <ProjectNotFound />
  }

  const projectIssues = issues.data.filter(
    ({ projectId: issueProjectId }) => issueProjectId === project.id,
  )

  return (
    <section className="page" aria-labelledby="project-detail-title">
      <header className="project-detail-header">
        <Link className="text-link" to="/projects">
          ← Projects
        </Link>
        <div>
          <p className="page-eyebrow">{project.key} · {project.status}</p>
          <h1 id="project-detail-title">{project.name}</h1>
          <p>{project.description}</p>
        </div>
      </header>

      <section className="work-panel" aria-labelledby="project-issues-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Current scope</p>
            <h2 id="project-issues-title">Project issues</h2>
          </div>
          <p>
            {projectIssues.length}{' '}
            {projectIssues.length === 1 ? 'issue' : 'issues'}
          </p>
        </div>
        <ol className="project-issue-list">
          {projectIssues.map((issue) => (
            <li key={issue.id}>
              <span>#{issue.number}</span>
              <strong>{issue.title}</strong>
              <span>Priority: {issue.priority}</span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  )
}

function ProjectNotFound() {
  return (
    <section className="page" aria-labelledby="project-detail-title">
      <ProjectDetailHeader title="Project not found" />
      <div className="empty-panel">
        <p className="empty-panel__status">Unknown project</p>
        <p>The requested project does not exist in this workspace.</p>
        <Link className="text-link" to="/projects">
          Return to projects
        </Link>
      </div>
    </section>
  )
}

function ProjectDetailHeader({ title }: Readonly<{ title: string }>) {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace project</p>
      <h1 id="project-detail-title">{title}</h1>
    </header>
  )
}

function parseProjectId(value: string | undefined): ProjectId | null {
  if (!value) {
    return null
  }

  try {
    return projectId(value)
  } catch {
    return null
  }
}
