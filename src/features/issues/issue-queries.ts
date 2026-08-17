import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import { atlasQueryKeys } from '../query-keys'
import { toIssueQuery, type IssueWorkspaceState } from './issue-workspace-state'
import type { AtlasGateway, CreateIssueInput } from '../../data'
import type { Issue, IssuePriority } from '../../domain'

export function useIssueWorkspaceData(state: IssueWorkspaceState) {
  const { gateway, workspaceId } = useAppServices()
  const query = toIssueQuery(workspaceId, state)
  const projects = useQuery({
    queryKey: atlasQueryKeys.projects(workspaceId),
    queryFn: ({ signal }) => gateway.listProjects(workspaceId, { signal }),
  })
  const issues = useQuery({
    queryKey: atlasQueryKeys.issues(workspaceId, query),
    queryFn: ({ signal }) => gateway.listIssues(query, { signal }),
    placeholderData: keepPreviousData,
  })

  return { issues, projects }
}

export function useIssueCreationMetadata(enabled: boolean) {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.issueCreationMetadata(workspaceId),
    queryFn: ({ signal }) =>
      gateway.getIssueCreationMetadata(workspaceId, { signal }),
    enabled,
  })
}

export function useCreateIssue() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateIssueInput) => gateway.createIssue(input),
    onSuccess: (issue) => {
      queryClient.setQueryData(
        atlasQueryKeys.issue(workspaceId, issue.id),
        issue,
      )
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
      })
    },
  })
}

export interface BulkIssueUpdateResult {
  readonly updated: readonly Issue[]
  readonly failed: readonly BulkIssueUpdateFailure[]
}

export interface BulkIssueUpdateFailure {
  readonly issue: Issue
  readonly message: string
}

export function useBulkUpdateIssuePriority() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      issues,
      priority,
    }: {
      issues: readonly Issue[]
      priority: IssuePriority
    }) => updateIssuePriorities(gateway, issues, priority),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
      })
    },
  })
}

export async function updateIssuePriorities(
  gateway: AtlasGateway,
  issues: readonly Issue[],
  priority: IssuePriority,
): Promise<BulkIssueUpdateResult> {
  const outcomes = await Promise.all(
    issues.map(async (issue) => {
      try {
        const updated = await gateway.updateIssue({
          id: issue.id,
          expectedRevision: issue.revision,
          changes: { priority },
        })
        return { status: 'updated' as const, issue: updated }
      } catch (error) {
        let currentIssue = issue

        try {
          currentIssue = await gateway.getIssue(issue.id)
        } catch {
          // Retain the submitted snapshot when recovery data is unavailable.
        }

        return {
          status: 'failed' as const,
          issue: currentIssue,
          message: error instanceof Error ? error.message : 'The update failed.',
        }
      }
    }),
  )

  return {
    updated: outcomes.flatMap((outcome) =>
      outcome.status === 'updated' ? [outcome.issue] : [],
    ),
    failed: outcomes.flatMap((outcome) =>
      outcome.status === 'failed'
        ? [{ issue: outcome.issue, message: outcome.message }]
        : [],
    ),
  }
}
