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
    .map((project) => {
      const issues = data.issues.filter(({ projectId }) => projectId === project.id)
      const completedIssues = issues.filter(
        ({ statusId }) => categoryByStatusId.get(statusId) === 'completed',
      ).length
      const openIssues = issues.filter(({ statusId }) => {
        const category = categoryByStatusId.get(statusId)
        return category !== 'completed' && category !== 'canceled'
      }).length

      return {
        project,
        totalIssues: issues.length,
        openIssues,
        completedIssues,
      }
    })

  return paginate(projects, validatePage(query.page ?? defaultPage))
}
