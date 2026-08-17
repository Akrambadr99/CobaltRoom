import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { TransferProjectLeadInput } from '../../data'
import type { ProjectId } from '../../domain'
import { atlasQueryKeys } from '../../app/query/keys'

export function useProjectLeadTransfer(projectId: ProjectId, enabled: boolean) {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.projectLeadTransfer(workspaceId, projectId),
    queryFn: ({ signal }) => gateway.getProjectLeadTransfer(projectId, { signal }),
    enabled,
  })
}

export function useTransferProjectLead(projectId: ProjectId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: `project:${projectId}:lead-transfer` },
    mutationFn: (input: TransferProjectLeadInput) =>
      gateway.transferProjectLead(input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.project(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectMembers(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectLeadTransfer(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectActivity(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.authorization(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
      ])
    },
  })
}
