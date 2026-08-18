import type { Page, ProjectSummary, ProjectSummaryQuery } from './contracts'
import { InvalidGatewayRequestError } from './errors'
import { paginate, validatePage } from './query'
import type { AtlasDataSnapshot } from '../snapshot'

const defaultPage = { number: 1, size: 12 } as const

export function queryProjectSummaries(
  data: AtlasDataSnapshot,
  query: ProjectSummaryQuery,
): Page<ProjectSummary> {
  const normalizedSearch = query.search?.trim().toLocaleLowerCase()
  if (normalizedSearch && normalizedSearch.length > 100) {
    throw new InvalidGatewayRequestError(
      'Project searches may not exceed 100 characters.',
    )
  }
  const categoryByStatusId = new Map(
    data.workflowStatuses.map(({ id, category }) => [id, category]),
  )
  const projects = data.projects
    .filter(
      (project) =>
        project.workspaceId === query.workspaceId &&
        (query.statuses === undefined || query.statuses.includes(project.status)) &&
        (!normalizedSearch ||
          project.name.toLocaleLowerCase().includes(normalizedSearch) ||
          project.key.toLocaleLowerCase().includes(normalizedSearch) ||
          project.description.toLocaleLowerCase().includes(normalizedSearch)),
    )
    .sort((left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    )
  const countsByProjectId = new Map(
    projects.map(({ id }) => [id, { totalIssues: 0, openIssues: 0, completedIssues: 0 }]),
  )
  for (const issue of data.issues) {
    const counts = countsByProjectId.get(issue.projectId)
    if (!counts) continue
    counts.totalIssues += 1
    const category = categoryByStatusId.get(issue.statusId)
    if (category === 'completed') counts.completedIssues += 1
    if (category !== 'completed' && category !== 'canceled') counts.openIssues += 1
  }

  const summaries = projects.map((project) => {
    const counts = countsByProjectId.get(project.id)
    return {
      project,
      totalIssues: counts?.totalIssues ?? 0,
      openIssues: counts?.openIssues ?? 0,
      completedIssues: counts?.completedIssues ?? 0,
    }
  })

  return paginate(summaries, validatePage(query.page ?? defaultPage))
}
