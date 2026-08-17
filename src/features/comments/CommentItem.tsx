import { useEffect, useRef, useState, type SyntheticEvent } from 'react'

import { useAuthorization } from '../../app/providers/authorization-context'
import { GatewayConflictError } from '../../data'
import type { Comment, IssueId, ProjectId, User, UserId } from '../../domain'
import { useConfirmationFocus } from '../../interactions/use-confirmation-focus'
import { useDeleteComment, useUpdateComment } from './comment-queries'

interface CommentFeedback {
  readonly kind: 'error' | 'status'
  readonly message: string
}

interface CommentItemProps {
  readonly authorName: string
  readonly comment: Comment
  readonly deletedByName: string | null
  readonly issueId: IssueId
  readonly mentionedUserIds: readonly UserId[]
  readonly mentionableUsers: readonly User[]
  readonly projectId: ProjectId
  readonly readOnly?: boolean
}

export function CommentItem({
  authorName,
  comment,
  deletedByName,
  issueId,
  mentionedUserIds,
  mentionableUsers,
  projectId,
  readOnly = false,
}: CommentItemProps) {
  const authorization = useAuthorization()
  const updateComment = useUpdateComment(issueId, comment.id)
  const deleteComment = useDeleteComment(issueId, comment.id)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const itemRef = useRef<HTMLLIElement>(null)
  const restoreEditFocusRef = useRef(false)
  const focusDeletedItemRef = useRef(false)
  const restoreDeleteFocusRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { confirmationRef, triggerRef } = useConfirmationFocus(confirmingDelete)
  const [draft, setDraft] = useState(comment.body)
  const [mentionUserId, setMentionUserId] = useState('')
  const [selectedMentionUserIds, setSelectedMentionUserIds] =
    useState<readonly UserId[]>(mentionedUserIds)
  const [feedback, setFeedback] = useState<CommentFeedback | null>(null)
  const isAuthor = comment.authorId === authorization.session.user.id
  const canEdit =
    !readOnly &&
    comment.deletedAt === null &&
    isAuthor &&
    authorization.can('comment:edit-own', projectId)
  const canDelete =
    !readOnly &&
    comment.deletedAt === null &&
    (isAuthor
      ? authorization.can('comment:delete-own', projectId)
      : authorization.can('comment:moderate', projectId))
  const deleteVerb = isAuthor ? 'Delete' : 'Remove'
  const messageId = `comment-message-${comment.id}`

  useEffect(() => {
    if (editing) {
      editTextAreaRef.current?.focus()
    } else if (restoreEditFocusRef.current) {
      editButtonRef.current?.focus()
      restoreEditFocusRef.current = false
    }
  }, [editing])

  useEffect(() => {
    if (comment.deletedAt !== null && focusDeletedItemRef.current) {
      itemRef.current?.focus()
      focusDeletedItemRef.current = false
    } else if (comment.deletedAt === null && restoreDeleteFocusRef.current) {
      confirmationRef.current?.focus()
      restoreDeleteFocusRef.current = false
    }
  }, [comment.deletedAt, confirmationRef])

  const handleEdit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const body = draft.trim()
    setFeedback(null)
    if (body.length === 0 || body.length > 5_000) {
      setFeedback({
        kind: 'error',
        message: 'Enter a comment between 1 and 5,000 characters.',
      })
      return
    }
    const activeMentionUserIds = selectedMentionUserIds.filter((userId) => {
      const user = mentionableUsers.find(({ id }) => id === userId)
      return user ? containsMention(body, user.displayName) : false
    })
    updateComment.mutate(
      { comment, body, mentionedUserIds: activeMentionUserIds },
      {
        onSuccess: () => {
          restoreEditFocusRef.current = true
          setEditing(false)
          setFeedback({ kind: 'status', message: 'Comment updated.' })
        },
        onError: (error) => {
          setFeedback({
            kind: 'error',
            message:
              error instanceof GatewayConflictError
                ? 'This comment changed elsewhere. The latest version is loaded; review your draft and retry.'
                : error.message,
          })
        },
      },
    )
  }

  const handleDelete = (): void => {
    setFeedback(null)
    focusDeletedItemRef.current = true
    restoreDeleteFocusRef.current = true
    deleteComment.mutate(
      { comment, deletedById: authorization.session.user.id },
      {
        onSuccess: () => {
          restoreDeleteFocusRef.current = false
          setConfirmingDelete(false)
          setFeedback({
            kind: 'status',
            message: isAuthor
              ? 'Comment deleted.'
              : 'Comment removed by moderation.',
          })
          focusDeletedItemRef.current = true
        },
        onError: (error) => {
          setFeedback({
            kind: 'error',
            message:
              error instanceof GatewayConflictError
                ? 'This comment changed elsewhere. The latest version is loaded; review it before trying again.'
                : error.message,
          })
        },
      },
    )
  }

  return (
    <li ref={itemRef} tabIndex={comment.deletedAt === null ? undefined : -1}>
      <div className="comment-list__meta">
        <strong>{authorName}</strong>
        <span>
          <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
          {comment.editedAt ? ' · edited' : null}
        </span>
      </div>
      {comment.deletedAt ? (
        <p className="comment-list__tombstone">
          Comment removed{deletedByName ? ` by ${deletedByName}` : ''}.
        </p>
      ) : editing ? (
        <form className="comment-edit-form" aria-label="Edit comment" onSubmit={handleEdit}>
          <label>
            <span>Edit comment</span>
            <textarea
              ref={editTextAreaRef}
              rows={4}
              maxLength={5_001}
              value={draft}
              aria-invalid={feedback?.kind === 'error'}
              aria-describedby={feedback ? messageId : undefined}
              onChange={(event) => {
                setDraft(event.currentTarget.value)
              }}
            />
          </label>
          {mentionableUsers.length > 0 ? (
            <div
              className="comment-form__mentions"
              aria-label="Mention a workspace member while editing"
            >
              <label htmlFor={`edit-mention-member-${comment.id}`}>
                Member to mention in this edit
              </label>
              <select
                id={`edit-mention-member-${comment.id}`}
                value={mentionUserId}
                onChange={(event) => {
                  setMentionUserId(event.currentTarget.value)
                }}
              >
                <option value="">Choose a member</option>
                {mentionableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} ({user.email})
                  </option>
                ))}
              </select>
              <button
                className="text-button"
                type="button"
                disabled={mentionUserId.length === 0}
                onClick={() => {
                  const user = mentionableUsers.find(({ id }) => id === mentionUserId)
                  if (!user) return
                  const token = `@${user.displayName}`
                  setDraft((current) =>
                    current.includes(token)
                      ? current
                      : `${current}${current.length > 0 && !current.endsWith(' ') ? ' ' : ''}${token} `,
                  )
                  setSelectedMentionUserIds((current) =>
                    current.includes(user.id) ? current : [...current, user.id],
                  )
                  setMentionUserId('')
                  editTextAreaRef.current?.focus()
                }}
              >
                Insert mention in edit
              </button>
            </div>
          ) : null}
          <div className="comment-list__actions">
            <button className="primary-button" type="submit" disabled={updateComment.isPending}>
              {updateComment.isPending ? 'Saving…' : 'Save comment'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={updateComment.isPending}
              onClick={() => {
                restoreEditFocusRef.current = true
                setEditing(false)
                setDraft(comment.body)
                setSelectedMentionUserIds(mentionedUserIds)
                setMentionUserId('')
                setFeedback(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p>{comment.body}</p>
      )}

      {comment.deletedAt === null && !editing ? (
        <div className="comment-list__actions">
          {canEdit ? (
            <button
              ref={editButtonRef}
              className="text-button"
              type="button"
              onClick={() => {
                setEditing(true)
                setDraft(comment.body)
                setSelectedMentionUserIds(mentionedUserIds)
                setMentionUserId('')
                setFeedback(null)
              }}
            >
              Edit comment
            </button>
          ) : null}
          {canDelete ? (
            confirmingDelete ? (
              <>
                <span>{deleteVerb} this comment?</span>
                <button
                  ref={confirmationRef}
                  className="danger-button"
                  type="button"
                  disabled={deleteComment.isPending}
                  onClick={handleDelete}
                >
                  {deleteComment.isPending
                    ? isAuthor
                      ? 'Deleting…'
                      : 'Removing…'
                    : `Confirm ${deleteVerb.toLocaleLowerCase()}`}
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={deleteComment.isPending}
                  onClick={() => {
                    setConfirmingDelete(false)
                    setFeedback(null)
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                ref={triggerRef}
                className="text-button"
                type="button"
                onClick={() => {
                  setConfirmingDelete(true)
                  setFeedback(null)
                }}
              >
                {deleteVerb} comment
              </button>
            )
          ) : null}
        </div>
      ) : null}
      {feedback ? (
        <p
          id={messageId}
          className={feedback.kind === 'error' ? 'form-error' : 'comment-list__status'}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </li>
  )
}

function containsMention(body: string, displayName: string): boolean {
  const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\s)@${escapedName}(?=$|[\\s.,!?;:])`, 'iu').test(body)
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}
