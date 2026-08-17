import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { IssueActivityData } from '../../data'
import type { Comment, IssueId, UserId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

interface UpdateCommentVariables {
  readonly comment: Comment
  readonly body: string
}

interface DeleteCommentVariables {
  readonly comment: Comment
  readonly deletedById: UserId
}

interface CommentMutationContext {
  readonly previous: IssueActivityData | undefined
}

export function useUpdateComment(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const activityKey = atlasQueryKeys.issueActivity(workspaceId, issueId)

  return useMutation<Comment, Error, UpdateCommentVariables, CommentMutationContext>({
    mutationFn: ({ comment, body }) =>
      gateway.updateComment({
        id: comment.id,
        expectedRevision: comment.revision,
        body,
      }),
    onMutate: async ({ comment, body }) => {
      await queryClient.cancelQueries({ queryKey: activityKey })
      const previous = queryClient.getQueryData<IssueActivityData>(activityKey)
      replaceComment(queryClient, activityKey, {
        ...comment,
        body,
        revision: comment.revision + 1,
      })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(activityKey, context.previous)
    },
    onSuccess: (comment) => {
      replaceComment(queryClient, activityKey, comment)
    },
    onSettled: async () => {
      await invalidateCommentRecords(queryClient, workspaceId, issueId)
    },
  })
}

export function useDeleteComment(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const activityKey = atlasQueryKeys.issueActivity(workspaceId, issueId)

  return useMutation<Comment, Error, DeleteCommentVariables, CommentMutationContext>({
    mutationFn: ({ comment }) =>
      gateway.deleteComment({
        id: comment.id,
        expectedRevision: comment.revision,
      }),
    onMutate: async ({ comment, deletedById }) => {
      await queryClient.cancelQueries({ queryKey: activityKey })
      const previous = queryClient.getQueryData<IssueActivityData>(activityKey)
      replaceComment(queryClient, activityKey, {
        ...comment,
        body: '',
        revision: comment.revision + 1,
        deletedAt: comment.createdAt,
        deletedById,
      })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(activityKey, context.previous)
    },
    onSuccess: (comment) => {
      replaceComment(queryClient, activityKey, comment)
    },
    onSettled: async () => {
      await invalidateCommentRecords(queryClient, workspaceId, issueId)
    },
  })
}

function replaceComment(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  updated: Comment,
): void {
  queryClient.setQueryData<IssueActivityData>(queryKey, (current) =>
    current
      ? {
          ...current,
          comments: current.comments.map((comment) =>
            comment.id === updated.id ? updated : comment,
          ),
        }
      : current,
  )
}

async function invalidateCommentRecords(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: Parameters<typeof atlasQueryKeys.governanceReports>[0],
  issueId: IssueId,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: atlasQueryKeys.issueActivity(workspaceId, issueId),
    }),
    queryClient.invalidateQueries({
      queryKey: atlasQueryKeys.governanceReports(workspaceId),
    }),
  ])
}
