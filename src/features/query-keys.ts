import type { WorkspaceId } from '../domain'

export const atlasQueryKeys = {
  projects: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'projects'] as const,
  dashboardIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'dashboard'] as const,
  projectIndexIssues: (workspaceId: WorkspaceId) =>
    ['workspaces', workspaceId, 'issues', 'project-index'] as const,
}
