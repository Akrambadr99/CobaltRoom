import type {
  AnalyticsRange,
  IssueFlowTrendPoint,
  WorkspaceAnalytics,
  WorkspaceAnalyticsQuery,
} from './contracts'
import type { AtlasDataSnapshot } from '../snapshot'
import type {
  Issue,
  IssuePriority,
  IsoDate,
  IsoDateTime,
  WorkflowStatusCategory,
} from '../../domain'
import { isoDate } from '../../domain'

const priorities: readonly IssuePriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]
const statusCategories: readonly WorkflowStatusCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]

export function buildWorkspaceAnalytics(
  data: AtlasDataSnapshot,
  query: WorkspaceAnalyticsQuery,
  generatedAt: IsoDateTime,
): WorkspaceAnalytics {
  const { workspaceId, range } = query
  const projects = data.projects.filter((project) => project.workspaceId === workspaceId)
  const issues = data.issues.filter((issue) => issue.workspaceId === workspaceId)
  const statuses = new Map(
    data.workflowStatuses.map((status) => [status.id, status.category]),
  )
  const currentDate = generatedAt.slice(0, 10)
  const isCompleted = (issue: Issue): boolean =>
    statuses.get(issue.statusId) === 'completed'
  const isOpen = (issue: Issue): boolean => {
    const category = statuses.get(issue.statusId)
    return category !== 'completed' && category !== 'canceled'
  }
  const isOverdue = (issue: Issue): boolean =>
    isOpen(issue) && issue.dueDate !== null && issue.dueDate < currentDate
  const openIssues = issues.filter(isOpen)
  const completedIssues = issues.filter(isCompleted)
  const rangeStart = getRangeStart(issues, generatedAt, range)
  const issueFlow = buildIssueFlow(issues, rangeStart, generatedAt, range)

  return {
    generatedAt,
    range,
    rangeStart,
    createdInRange: issueFlow.reduce((total, point) => total + point.createdIssues, 0),
    updatedInRange: issueFlow.reduce((total, point) => total + point.updatedIssues, 0),
    issueFlow,
    activeProjects: projects.filter(({ status }) => status === 'active').length,
    totalIssues: issues.length,
    openIssues: openIssues.length,
    completedIssues: completedIssues.length,
    urgentOpenIssues: openIssues.filter(({ priority }) => priority === 'urgent').length,
    overdueIssues: issues.filter(isOverdue).length,
    unassignedOpenIssues: openIssues.filter(({ assigneeId }) => assigneeId === null)
      .length,
    priorities: priorities.map((value) => ({
      value,
      count: issues.filter(({ priority }) => priority === value).length,
    })),
    statusCategories: statusCategories.map((value) => ({
      value,
      count: issues.filter((issue) => statuses.get(issue.statusId) === value).length,
    })),
    projects: projects
      .map((project) => {
        const projectIssues = issues.filter(({ projectId }) => projectId === project.id)
        const projectCompleted = projectIssues.filter(isCompleted).length
        const projectOpen = projectIssues.filter(isOpen)
        return {
          projectId: project.id,
          projectKey: project.key,
          projectName: project.name,
          totalIssues: projectIssues.length,
          openIssues: projectOpen.length,
          completedIssues: projectCompleted,
          urgentOpenIssues: projectOpen.filter(({ priority }) => priority === 'urgent')
            .length,
          overdueIssues: projectIssues.filter(isOverdue).length,
          completionPercent:
            projectIssues.length === 0
              ? 0
              : Math.round((projectCompleted / projectIssues.length) * 100),
        }
      })
      .sort((left, right) => left.projectName.localeCompare(right.projectName)),
  }
}

function getRangeStart(
  issues: readonly Issue[],
  generatedAt: IsoDateTime,
  range: AnalyticsRange,
): IsoDate {
  const end = atUtcMidnight(generatedAt)
  if (range === 'all-time') {
    const earliest = issues
      .map(({ createdAt }) => createdAt.slice(0, 10))
      .sort()[0] ?? generatedAt.slice(0, 10)
    return isoDate(`${earliest.slice(0, 7)}-01`)
  }
  const days = range === '30-days' ? 29 : 89
  end.setUTCDate(end.getUTCDate() - days)
  return toIsoDate(end)
}

function buildIssueFlow(
  issues: readonly Issue[],
  rangeStart: IsoDate,
  generatedAt: IsoDateTime,
  range: AnalyticsRange,
): readonly IssueFlowTrendPoint[] {
  const start = atUtcMidnight(rangeStart)
  const end = new Date(generatedAt)
  const points: IssueFlowTrendPoint[] = []
  if (range === 'all-time') {
    const cursor = new Date(start)
    while (cursor <= end) {
      points.push({ periodStart: toIsoDate(cursor), createdIssues: 0, updatedIssues: 0 })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  } else {
    const cursor = new Date(start)
    while (cursor <= end) {
      points.push({ periodStart: toIsoDate(cursor), createdIssues: 0, updatedIssues: 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
  }

  for (const issue of issues) {
    incrementFlow(points, issue.createdAt, 'createdIssues', start, end, range)
    incrementFlow(points, issue.updatedAt, 'updatedIssues', start, end, range)
  }
  return points
}

function incrementFlow(
  points: IssueFlowTrendPoint[],
  value: IsoDateTime,
  field: 'createdIssues' | 'updatedIssues',
  start: Date,
  end: Date,
  range: AnalyticsRange,
): void {
  const date = new Date(value)
  if (date < start || date > end) return
  const index = range === 'all-time'
    ? (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      date.getUTCMonth() - start.getUTCMonth()
    : Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1_000))
  const point = points[index]
  if (point) points[index] = { ...point, [field]: point[field] + 1 }
}

function atUtcMidnight(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function toIsoDate(value: Date): IsoDate {
  return isoDate(value.toISOString().slice(0, 10))
}
