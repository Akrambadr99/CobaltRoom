import { useMemo, type SyntheticEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable, type DataTableColumn } from '../../components/data-table/DataTable'
import type { IssueSortField } from '../../data'
import type { Issue, IssuePriority, Project } from '../../domain'
import { useIssueWorkspaceData } from '../../features/issues/issue-queries'
import {
  parseIssueWorkspaceState,
  serializeIssueWorkspaceState,
  type IssueWorkspaceState,
} from '../../features/issues/issue-workspace-state'
import './issues-page.css'
import './pages.css'

const priorityOptions: readonly IssuePriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]

export function IssuesPage() {
  const [parameters, setParameters] = useSearchParams()
  const state = useMemo(() => parseIssueWorkspaceState(parameters), [parameters])
  const { issues, projects } = useIssueWorkspaceData(state)

  const updateState = (changes: Partial<IssueWorkspaceState>) => {
    setParameters(
      serializeIssueWorkspaceState({ ...state, ...changes, page: changes.page ?? 1 }),
    )
  }

  const handleSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('search')
    updateState({
      search: typeof value === 'string' ? value.trim().slice(0, 200) : '',
    })
  }

  const handleSort = (field: string) => {
    const sortField = field as IssueSortField
    updateState({
      sortField,
      sortDirection:
        state.sortField === sortField && state.sortDirection === 'ascending'
          ? 'descending'
          : 'ascending',
    })
  }

  const isInitialLoading = issues.isPending || projects.isPending

  return (
    <section className="page" aria-labelledby="issues-title">
      <header className="page-header issues-header">
        <div>
          <p className="page-eyebrow">Workspace execution</p>
          <h1 id="issues-title">Issues</h1>
          <p>Find, prioritize, and review work across every active project.</p>
        </div>
        {issues.data ? (
          <p className="issues-header__count" aria-live="polite">
            {issues.data.totalItems} matching{' '}
            {issues.data.totalItems === 1 ? 'issue' : 'issues'}
          </p>
        ) : null}
      </header>

      <form className="issue-filters" role="search" onSubmit={handleSearch}>
        <label className="issue-filter issue-filter--search">
          <span>Search issues</span>
          <input
            key={state.search}
            name="search"
            type="search"
            defaultValue={state.search}
            maxLength={200}
            placeholder="Title, description, or number"
          />
        </label>
        <label className="issue-filter">
          <span>Project</span>
          <select
            value={state.projectId ?? ''}
            onChange={(event) => {
              updateState({
                projectId:
                  projects.data?.find(({ id }) => id === event.currentTarget.value)
                    ?.id ?? null,
              })
            }}
          >
            <option value="">All projects</option>
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="issue-filter">
          <span>Priority</span>
          <select
            value={state.priority ?? ''}
            onChange={(event) => {
              updateState({
                priority:
                  priorityOptions.find(
                    (priority) => priority === event.currentTarget.value,
                  ) ?? null,
              })
            }}
          >
            <option value="">All priorities</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {capitalize(priority)}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="submit">
          Search
        </button>
      </form>

      {isInitialLoading ? (
        <div className="dashboard-state" role="status" aria-live="polite">
          Loading issues…
        </div>
      ) : issues.isError || projects.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Issues are unavailable</h2>
          <p>The local service could not load this workspace.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void Promise.all([issues.refetch(), projects.refetch()])}
          >
            Retry issues
          </button>
        </div>
      ) : (
        <IssueResults
          issues={issues.data.items}
          projects={projects.data}
          pageNumber={issues.data.pageNumber}
          pageCount={issues.data.pageCount}
          totalItems={issues.data.totalItems}
          state={state}
          isRefreshing={issues.isFetching}
          onPageChange={(page) => {
            updateState({ page })
          }}
          onSort={handleSort}
        />
      )}
    </section>
  )
}

interface IssueResultsProps {
  readonly issues: readonly Issue[]
  readonly projects: readonly Project[]
  readonly pageNumber: number
  readonly pageCount: number
  readonly totalItems: number
  readonly state: IssueWorkspaceState
  readonly isRefreshing: boolean
  readonly onPageChange: (page: number) => void
  readonly onSort: (field: string) => void
}

function IssueResults({
  issues,
  projects,
  pageNumber,
  pageCount,
  totalItems,
  state,
  isRefreshing,
  onPageChange,
  onSort,
}: IssueResultsProps) {
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const columns: readonly DataTableColumn<Issue>[] = [
    {
      id: 'number',
      label: 'Issue',
      sortField: 'number',
      render: (issue) => (
        <span className="issue-identifier">
          {projectById.get(issue.projectId)?.key ?? '—'}-{issue.number}
        </span>
      ),
    },
    {
      id: 'title',
      label: 'Title',
      sortField: 'title',
      render: (issue) => <strong>{issue.title}</strong>,
    },
    {
      id: 'project',
      label: 'Project',
      render: (issue) => projectById.get(issue.projectId)?.name ?? 'Unknown project',
    },
    {
      id: 'priority',
      label: 'Priority',
      sortField: 'priority',
      render: (issue) => (
        <span className={`priority-badge priority-badge--${issue.priority}`}>
          {capitalize(issue.priority)}
        </span>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      render: (issue) => capitalize(issue.type),
    },
    {
      id: 'dueDate',
      label: 'Due',
      sortField: 'dueDate',
      render: (issue) => issue.dueDate ?? 'No due date',
    },
  ]

  if (issues.length === 0 && totalItems > 0) {
    return (
      <div className="empty-panel">
        <p className="empty-panel__status">Page out of range</p>
        <p>The requested page no longer exists for this result set.</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            onPageChange(1)
          }}
        >
          Return to first page
        </button>
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div className="empty-panel">
        <p className="empty-panel__status">No matching issues</p>
        <p>Try removing a filter or using a broader search term.</p>
      </div>
    )
  }

  return (
    <div className="issue-results" aria-busy={isRefreshing}>
      {isRefreshing ? <p className="issue-results__refresh">Refreshing results…</p> : null}
      <DataTable
        caption="Workspace issues"
        columns={columns}
        getRowKey={(issue) => issue.id}
        rows={issues}
        sort={{ field: state.sortField, direction: state.sortDirection }}
        onSort={onSort}
      />
      <nav className="pagination" aria-label="Issues pagination">
        <button
          className="secondary-button"
          type="button"
          disabled={pageNumber <= 1}
          onClick={() => {
            onPageChange(pageNumber - 1)
          }}
        >
          Previous
        </button>
        <p aria-live="polite">
          Page {pageNumber} of {Math.max(pageCount, 1)}
        </p>
        <button
          className="secondary-button"
          type="button"
          disabled={pageNumber >= pageCount}
          onClick={() => {
            onPageChange(pageNumber + 1)
          }}
        >
          Next
        </button>
      </nav>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
