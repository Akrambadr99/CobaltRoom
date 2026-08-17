import type { IssueQuery } from '../data'
import type { WorkspaceId } from '../domain'

export const atlasQueryKeys = {
  projects: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'projects'] as const,
  dashboardIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'dashboard'] as const,
  projectIndexIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'project-index'] as const,
  issues: (workspaceId: WorkspaceId, query: IssueQuery) =>
    ['workspaces', workspaceId, 'issues', 'index', query] as const,
}
