import { InvalidGatewayRequestError } from './errors'
import type { IssueQuery, IssueSortField, Page, PageRequest } from './contracts'
import type { Issue, IssuePriority } from '../../domain'

const defaultPage = { number: 1, size: 25 } as const

const priorityOrder: Readonly<Record<IssuePriority, number>> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

export function queryIssues(
  issues: readonly Issue[],
  query: IssueQuery,
): Page<Issue> {
  const page = validatePage(query.page ?? defaultPage)
  const filtered = issues.filter((issue) => matchesIssue(issue, query))
  const sorted = sortIssues(filtered, query)

  return paginate(sorted, page)
}

function matchesIssue(issue: Issue, query: IssueQuery): boolean {
  const { filters } = query
  const normalizedSearch = filters.search?.trim().toLocaleLowerCase()
  const matchesAssignee =
    filters.assigneeIds === undefined ||
    (issue.assigneeId === null
      ? filters.includeUnassigned === true
      : filters.assigneeIds.includes(issue.assigneeId))

  return (
    issue.workspaceId === filters.workspaceId &&
    (filters.projectIds === undefined ||
      filters.projectIds.includes(issue.projectId)) &&
    (filters.statusIds === undefined ||
      filters.statusIds.includes(issue.statusId)) &&
    (filters.priorities === undefined ||
      filters.priorities.includes(issue.priority)) &&
    matchesAssignee &&
    (!normalizedSearch ||
      issue.title.toLocaleLowerCase().includes(normalizedSearch) ||
      issue.description.toLocaleLowerCase().includes(normalizedSearch) ||
      issue.number.toString().includes(normalizedSearch))
  )
}

function sortIssues(issues: readonly Issue[], query: IssueQuery): readonly Issue[] {
  const sort = query.sort ?? { field: 'updatedAt', direction: 'descending' }
  const direction = sort.direction === 'ascending' ? 1 : -1

  return issues
    .map((issue, originalIndex) => ({ issue, originalIndex }))
    .sort((left, right) => {
      const comparison = compareIssueField(
        left.issue,
        right.issue,
        sort.field,
      )

      return comparison === 0
        ? left.originalIndex - right.originalIndex
        : comparison * direction
    })
    .map(({ issue }) => issue)
}

function compareIssueField(
  left: Issue,
  right: Issue,
  field: IssueSortField,
): number {
  if (field === 'priority') {
    return priorityOrder[left.priority] - priorityOrder[right.priority]
  }

  if (field === 'number') {
    return left.number - right.number
  }

  const leftValue = left[field] ?? ''
  const rightValue = right[field] ?? ''
  return leftValue.localeCompare(rightValue)
}

export function validatePage(page: PageRequest): PageRequest {
  if (
    !Number.isSafeInteger(page.number) ||
    page.number < 1 ||
    !Number.isSafeInteger(page.size) ||
    page.size < 1 ||
    page.size > 100
  ) {
    throw new InvalidGatewayRequestError(
      'Page numbers must be positive integers and page sizes must be between 1 and 100.',
    )
  }

  return page
}

export function paginate<T>(items: readonly T[], page: PageRequest): Page<T> {
  const offset = (page.number - 1) * page.size

  return {
    items: items.slice(offset, offset + page.size),
    pageNumber: page.number,
    pageSize: page.size,
    pageCount: Math.ceil(items.length / page.size),
    totalItems: items.length,
  }
}
