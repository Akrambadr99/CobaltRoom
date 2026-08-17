import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { IssueActivityData } from '../../data'
import type { Comment, CommentId, IssueId, UserId } from '../../domain'
import { atlasQueryKeys } from '../../app/query/keys'

interface UpdateCommentVariables {
  readonly comment: Comment
  readonly body: string
  readonly mentionedUserIds: readonly UserId[]
}

interface DeleteCommentVariables {
  readonly comment: Comment
  readonly deletedById: UserId
}

interface CommentMutationContext {
  readonly previousComment: Comment
  readonly optimisticRevision: number
}

export function useUpdateComment(issueId: IssueId, commentId: CommentId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const activityKey = atlasQueryKeys.issueActivity(workspaceId, issueId)

  return useMutation<Comment, Error, UpdateCommentVariables, CommentMutationContext>({
    scope: { id: `comment:${commentId}` },
    mutationFn: ({ comment, body, mentionedUserIds }) =>
      gateway.updateComment({
        id: comment.id,
        expectedRevision: comment.revision,
        body,
        mentionedUserIds,
      }),
    onMutate: async ({ comment, body }) => {
      await queryClient.cancelQueries({ queryKey: activityKey })
      const previous = queryClient.getQueryData<IssueActivityData>(activityKey)
      const previousComment =
        previous?.comments.find(({ id }) => id === comment.id) ?? comment
      const optimisticRevision = previousComment.revision + 1
      replaceComment(queryClient, activityKey, {
        ...previousComment,
        body,
        revision: optimisticRevision,
      })
      return { previousComment, optimisticRevision }
    },
    onError: (_error, _variables, context) => {
      if (context) {
        rollbackComment(
          queryClient,
          activityKey,
          context.previousComment,
          context.optimisticRevision,
        )
      }
    },
    onSuccess: (comment) => {
      replaceComment(queryClient, activityKey, comment)
    },
    onSettled: async () => {
      await invalidateCommentRecords(queryClient, workspaceId, issueId)
    },
  })
}

export function useDeleteComment(issueId: IssueId, commentId: CommentId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const activityKey = atlasQueryKeys.issueActivity(workspaceId, issueId)

  return useMutation<Comment, Error, DeleteCommentVariables, CommentMutationContext>({
    scope: { id: `comment:${commentId}` },
    mutationFn: ({ comment }) =>
      gateway.deleteComment({
        id: comment.id,
        expectedRevision: comment.revision,
      }),
    onMutate: async ({ comment, deletedById }) => {
      await queryClient.cancelQueries({ queryKey: activityKey })
      const previous = queryClient.getQueryData<IssueActivityData>(activityKey)
      const previousComment =
        previous?.comments.find(({ id }) => id === comment.id) ?? comment
      const optimisticRevision = previousComment.revision + 1
      replaceComment(queryClient, activityKey, {
        ...previousComment,
        body: '',
        revision: optimisticRevision,
        deletedAt: previousComment.createdAt,
        deletedById,
      })
      return { previousComment, optimisticRevision }
    },
    onError: (_error, _variables, context) => {
      if (context) {
        rollbackComment(
          queryClient,
          activityKey,
          context.previousComment,
          context.optimisticRevision,
        )
      }
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
            comment.id === updated.id && comment.revision <= updated.revision
              ? updated
              : comment,
          ),
        }
      : current,
  )
}

function rollbackComment(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  previous: Comment,
  optimisticRevision: number,
): void {
  queryClient.setQueryData<IssueActivityData>(queryKey, (current) =>
    current
      ? {
          ...current,
          comments: current.comments.map((comment) =>
            comment.id === previous.id && comment.revision === optimisticRevision
              ? previous
              : comment,
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
    queryClient.invalidateQueries({
      queryKey: atlasQueryKeys.workspaceActivityReports(workspaceId),
    }),
    queryClient.invalidateQueries({
      queryKey: atlasQueryKeys.notifications(workspaceId),
    }),
  ])
}
