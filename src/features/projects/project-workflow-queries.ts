import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { UpdateProjectWorkflowInput } from '../../data'
import type { ProjectId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

export function useProjectWorkflowAdministration(
  projectId: ProjectId,
  enabled: boolean,
) {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.projectWorkflow(workspaceId, projectId),
    queryFn: ({ signal }) =>
      gateway.getProjectWorkflowAdministration(projectId, { signal }),
    enabled,
  })
}

export function useUpdateProjectWorkflow(projectId: ProjectId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: `project:${projectId}` },
    mutationFn: (input: UpdateProjectWorkflowInput) =>
      gateway.updateProjectWorkflow(input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectWorkflow(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.project(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.boardMetadata(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueCreationMetadata(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.analytics(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectActivity(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.authorization(workspaceId),
        }),
      ])
    },
  })
}
