import { useQuery } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { AtlasGateway } from '../../data'
import type { Issue, WorkspaceId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'
import type { ProjectWorkspaceState } from './project-workspace-state'

export function useProjectSummaries(state: ProjectWorkspaceState) {
  const { gateway, workspaceId } = useAppServices()
  const query = {
    workspaceId,
    ...(state.search ? { search: state.search } : {}),
    ...(state.status ? { statuses: [state.status] } : {}),
    page: { number: state.page, size: 12 },
  }

  return useQuery({
    queryKey: atlasQueryKeys.projectSummaries(query),
    queryFn: ({ signal }) => gateway.listProjectSummaries(query, { signal }),
  })
}

export function useProjectsIndexData() {
  const { gateway, workspaceId } = useAppServices()
  const projects = useQuery({
    queryKey: atlasQueryKeys.projects(workspaceId),
    queryFn: ({ signal }) => gateway.listProjects(workspaceId, { signal }),
  })
  const issues = useQuery({
    queryKey: atlasQueryKeys.projectIndexIssues(workspaceId),
    queryFn: ({ signal }) =>
      loadAllWorkspaceIssues(gateway, workspaceId, signal),
  })

  return { issues, projects }
}

async function loadAllWorkspaceIssues(
  gateway: AtlasGateway,
  workspaceId: WorkspaceId,
  signal: AbortSignal,
): Promise<readonly Issue[]> {
  const firstPage = await gateway.listIssues(
    {
      filters: { workspaceId },
      sort: { field: 'updatedAt', direction: 'descending' },
      page: { number: 1, size: 100 },
    },
    { signal },
  )

  if (firstPage.pageCount <= 1) {
    return firstPage.items
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pageCount - 1 }, (_, index) =>
      gateway.listIssues(
        {
          filters: { workspaceId },
          sort: { field: 'updatedAt', direction: 'descending' },
          page: { number: index + 2, size: firstPage.pageSize },
        },
        { signal },
      ),
    ),
  )

  return [firstPage, ...remainingPages].flatMap(({ items }) => items)
}
