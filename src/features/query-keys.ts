import type { GovernanceQuery, IssueQuery } from '../data'
import type { IssueId, ProjectId, WorkspaceId } from '../domain'

export const atlasQueryKeys = {
  authorization: (workspaceId: WorkspaceId) =>
    ['authorization', workspaceId] as const,
  analytics: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'analytics'] as const,
  governanceReports: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'governance'] as const,
  governance: (query: GovernanceQuery) =>
    [...atlasQueryKeys.governanceReports(query.workspaceId), query] as const,
  globalSearch: (workspaceId: WorkspaceId, search: string) =>
    ['workspaces', workspaceId, 'search', search] as const,
  boardMetadata: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'board', 'metadata'] as const,
  boardIssues: (workspaceId: WorkspaceId, projectId: ProjectId) =>
    ['workspaces', workspaceId, 'issues', 'board', projectId] as const,
  workspaceIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues'] as const,
  projects: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'projects'] as const,
  dashboardIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'dashboard'] as const,
  projectIndexIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'project-index'] as const,
  issues: (workspaceId: WorkspaceId, query: IssueQuery) =>
    ['workspaces', workspaceId, 'issues', 'index', query] as const,
  issue: (workspaceId: WorkspaceId, issueId: IssueId) =>
    ['workspaces', workspaceId, 'issues', 'detail', issueId] as const,
  issueCreationMetadata: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'creation-metadata'] as const,
  issueActivity: (workspaceId: WorkspaceId, issueId: IssueId) =>
    ['workspaces', workspaceId, 'issues', 'detail', issueId, 'activity'] as const,
  notifications: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'notifications'] as const,
  notificationInbox: (workspaceId: WorkspaceId) =>
    [...atlasQueryKeys.notifications(workspaceId), 'inbox'] as const,
  notificationPreferences: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'notifications', 'preferences'] as const,
}
