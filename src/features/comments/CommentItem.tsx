import { useEffect, useRef, useState, type SyntheticEvent } from 'react'

import { useAuthorization } from '../../app/providers/authorization-context'
import { GatewayConflictError } from '../../data'
import type { Comment, IssueId, ProjectId } from '../../domain'
import { useDeleteComment, useUpdateComment } from './comment-queries'

interface CommentItemProps {
  readonly authorName: string
  readonly comment: Comment
  readonly deletedByName: string | null
  readonly issueId: IssueId
  readonly projectId: ProjectId
}

export function CommentItem({
  authorName,
  comment,
  deletedByName,
  issueId,
  projectId,
}: CommentItemProps) {
  const authorization = useAuthorization()
  const updateComment = useUpdateComment(issueId, comment.id)
  const deleteComment = useDeleteComment(issueId, comment.id)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const itemRef = useRef<HTMLLIElement>(null)
  const restoreEditFocusRef = useRef(false)
  const focusDeletedItemRef = useRef(false)
  const restoreDeleteFocusRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [message, setMessage] = useState('')
  const isAuthor = comment.authorId === authorization.session.user.id
  const canEdit =
    comment.deletedAt === null &&
    isAuthor &&
    authorization.can('comment:edit-own', projectId)
  const canDelete =
    comment.deletedAt === null &&
    (isAuthor
      ? authorization.can('comment:delete-own', projectId)
      : authorization.can('comment:moderate', projectId))
  const deleteVerb = isAuthor ? 'Delete' : 'Remove'
  const messageIsError =
    message.startsWith('Enter a comment') ||
    updateComment.isError ||
    deleteComment.isError
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
      deleteButtonRef.current?.focus()
      restoreDeleteFocusRef.current = false
    }
  }, [comment.deletedAt])

  const handleEdit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const body = draft.trim()
    setMessage('')
    if (body.length === 0 || body.length > 5_000) {
      setMessage('Enter a comment between 1 and 5,000 characters.')
      return
    }
    updateComment.mutate(
      { comment, body },
      {
        onSuccess: () => {
          restoreEditFocusRef.current = true
          setEditing(false)
          setMessage('Comment updated.')
        },
        onError: (error) => {
          setMessage(
            error instanceof GatewayConflictError
              ? 'This comment changed elsewhere. The latest version is loaded; review your draft and retry.'
              : error.message,
          )
        },
      },
    )
  }

  const handleDelete = (): void => {
    setMessage('')
    focusDeletedItemRef.current = true
    restoreDeleteFocusRef.current = true
    deleteComment.mutate(
      { comment, deletedById: authorization.session.user.id },
      {
        onSuccess: () => {
          restoreDeleteFocusRef.current = false
          setConfirmingDelete(false)
          setMessage(isAuthor ? 'Comment deleted.' : 'Comment removed by moderation.')
          focusDeletedItemRef.current = true
        },
        onError: (error) => {
          setMessage(
            error instanceof GatewayConflictError
              ? 'This comment changed elsewhere. The latest version is loaded; review it before trying again.'
              : error.message,
          )
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
              aria-invalid={message.startsWith('Enter a comment')}
              aria-describedby={message ? messageId : undefined}
              onChange={(event) => {
                setDraft(event.currentTarget.value)
              }}
            />
          </label>
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
                setMessage('')
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
                setMessage('')
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
                  ref={deleteButtonRef}
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
                    setMessage('')
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                ref={deleteButtonRef}
                className="text-button"
                type="button"
                onClick={() => {
                  setConfirmingDelete(true)
                  setMessage('')
                }}
              >
                {deleteVerb} comment
              </button>
            )
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p
          id={messageId}
          className={messageIsError ? 'form-error' : 'comment-list__status'}
          role={messageIsError ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}
    </li>
  )
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}
