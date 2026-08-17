import type { WorkspaceAnalytics } from './contracts'
import type { AtlasDataSnapshot } from '../snapshot'
import type {
  Issue,
  IssuePriority,
  IsoDateTime,
  WorkflowStatusCategory,
  WorkspaceId,
} from '../../domain'

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
  workspaceId: WorkspaceId,
  generatedAt: IsoDateTime,
): WorkspaceAnalytics {
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

  return {
    generatedAt,
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
