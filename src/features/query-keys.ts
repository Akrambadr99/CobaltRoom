import type { IssueQuery } from '../data'
import type { IssueId, WorkspaceId } from '../domain'

export const atlasQueryKeys = {
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
}
