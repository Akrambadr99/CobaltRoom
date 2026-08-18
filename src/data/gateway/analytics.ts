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
  const priorityCounts = new Map(priorities.map((priority) => [priority, 0]))
  const categoryCounts = new Map(statusCategories.map((category) => [category, 0]))
  const projectCounts = new Map(
    projects.map(({ id }) => [id, createProjectCounts()]),
  )
  let openIssueCount = 0
  let completedIssueCount = 0
  let urgentOpenIssueCount = 0
  let overdueIssueCount = 0
  let unassignedOpenIssueCount = 0

  for (const issue of issues) {
    const category = statuses.get(issue.statusId)
    const isCompleted = category === 'completed'
    const isOpen = category !== 'completed' && category !== 'canceled'
    const isOverdue = isOpen && issue.dueDate !== null && issue.dueDate < currentDate
    priorityCounts.set(issue.priority, (priorityCounts.get(issue.priority) ?? 0) + 1)
    if (category !== undefined) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    }
    if (isOpen) openIssueCount += 1
    if (isCompleted) completedIssueCount += 1
    if (isOpen && issue.priority === 'urgent') urgentOpenIssueCount += 1
    if (isOverdue) overdueIssueCount += 1
    if (isOpen && issue.assigneeId === null) unassignedOpenIssueCount += 1

    const counts = projectCounts.get(issue.projectId)
    if (!counts) continue
    counts.totalIssues += 1
    if (isOpen) counts.openIssues += 1
    if (isCompleted) counts.completedIssues += 1
    if (isOpen && issue.priority === 'urgent') counts.urgentOpenIssues += 1
    if (isOverdue) counts.overdueIssues += 1
  }
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
    openIssues: openIssueCount,
    completedIssues: completedIssueCount,
    urgentOpenIssues: urgentOpenIssueCount,
    overdueIssues: overdueIssueCount,
    unassignedOpenIssues: unassignedOpenIssueCount,
    priorities: priorities.map((value) => ({
      value,
      count: priorityCounts.get(value) ?? 0,
    })),
    statusCategories: statusCategories.map((value) => ({
      value,
      count: categoryCounts.get(value) ?? 0,
    })),
    projects: projects
      .map((project) => {
        const counts = projectCounts.get(project.id) ?? createProjectCounts()
        return {
          projectId: project.id,
          projectKey: project.key,
          projectName: project.name,
          ...counts,
          completionPercent:
            counts.totalIssues === 0
              ? 0
              : Math.round((counts.completedIssues / counts.totalIssues) * 100),
        }
      })
      .sort((left, right) => left.projectName.localeCompare(right.projectName)),
  }
}

function createProjectCounts() {
  return {
    totalIssues: 0,
    openIssues: 0,
    completedIssues: 0,
    urgentOpenIssues: 0,
    overdueIssues: 0,
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
