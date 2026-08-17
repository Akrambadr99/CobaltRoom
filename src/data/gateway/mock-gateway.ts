import type {
  AtlasGateway,
  BoardMetadata,
  CreateCommentInput,
  CreateIssueInput,
  DeleteIssueInput,
  IssueCreationMetadata,
  IssueActivityData,
  IssueQuery,
  MarkNotificationReadInput,
  NotificationInbox,
  Page,
  RequestOptions,
  UpdateIssueInput,
} from './contracts'
import {
  EntityNotFoundError,
  ForbiddenGatewayError,
  GatewayConflictError,
  GatewayError,
  InvalidGatewayRequestError,
  RequestCancelledError,
} from './errors'
import { queryIssues } from './query'
import { SimulatedNetwork, type RequestSimulator } from './simulation'
import {
  noopRequestTracer,
  type GatewayOperation,
  type RequestTracer,
} from './tracing'
import { SystemClock, type Clock } from '../clock'
import { DeterministicIdGenerator } from '../id-generator'
import type { AtlasDataSnapshot } from '../snapshot'
import { StaleSnapshotError, type InMemoryDataStore } from '../store'
import {
  can,
  type ActivityEvent,
  type Comment,
  type Issue,
  type IssueId,
  type Notification,
  type Permission,
  type Project,
  type ProjectId,
  type UserId,
  type WorkspaceId,
  isoDate,
} from '../../domain'

const openProjectStatuses: ReadonlySet<Project['status']> = new Set([
  'planned',
  'active',
  'paused',
])

export interface MockAtlasGatewayOptions {
  readonly store: InMemoryDataStore
  readonly actorId: UserId
  readonly clock?: Clock
  readonly idGenerator?: DeterministicIdGenerator
  readonly simulator?: RequestSimulator
  readonly tracer?: RequestTracer
}

function compareTimelineEntries(
  left: Comment | ActivityEvent,
  right: Comment | ActivityEvent,
): number {
  const leftTimestamp = 'createdAt' in left ? left.createdAt : left.occurredAt
  const rightTimestamp = 'createdAt' in right ? right.createdAt : right.occurredAt

  return (
    rightTimestamp.localeCompare(leftTimestamp) || right.id.localeCompare(left.id)
  )
}

export class MockAtlasGateway implements AtlasGateway {
  private readonly store: InMemoryDataStore
  private readonly actorId: UserId
  private readonly clock: Clock
  private readonly ids: DeterministicIdGenerator
  private readonly simulator: RequestSimulator
  private readonly tracer: RequestTracer
  private requestSequence = 0

  constructor(options: MockAtlasGatewayOptions) {
    this.store = options.store
    this.actorId = options.actorId
    this.clock = options.clock ?? new SystemClock()
    this.ids = options.idGenerator ?? new DeterministicIdGenerator('gateway')
    this.simulator = options.simulator ?? new SimulatedNetwork()
    this.tracer = options.tracer ?? noopRequestTracer
  }

  listProjects(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<readonly Project[]> {
    return this.execute('project.list', options, () => {
      this.assertPermission('project:view', workspaceId)
      return this.store
        .read()
        .data.projects.filter((project) => project.workspaceId === workspaceId)
        .sort((left, right) => left.name.localeCompare(right.name))
    })
  }

  listIssues(query: IssueQuery, options?: RequestOptions): Promise<Page<Issue>> {
    return this.execute('issue.list', options, () => {
      this.assertPermission('issue:view', query.filters.workspaceId)
      return queryIssues(this.store.read().data.issues, query)
    })
  }

  getIssue(id: IssueId, options?: RequestOptions): Promise<Issue> {
    return this.execute('issue.get', options, () => {
      const issue = this.store.read().data.issues.find((candidate) => candidate.id === id)

      if (!issue) {
        throw new EntityNotFoundError('Issue')
      }

      this.assertPermission('issue:view', issue.workspaceId, issue.projectId)
      return issue
    })
  }

  getIssueCreationMetadata(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<IssueCreationMetadata> {
    return this.execute('issue.creation-metadata', options, () => {
      this.assertPermission('issue:view', workspaceId)
      const data = this.store.read().data
      const projects = data.projects
        .filter(
          (project) =>
            project.workspaceId === workspaceId &&
            openProjectStatuses.has(project.status) &&
            this.hasPermission('issue:create', workspaceId, project.id),
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((project) => {
          const assignableUserIds = new Set(
            data.projectMembers
              .filter(({ projectId }) => projectId === project.id)
              .map(({ userId }) => userId),
          )
          const activeUserIds = new Set(
            data.memberships
              .filter(
                (membership) =>
                  membership.workspaceId === workspaceId &&
                  membership.status === 'active',
              )
              .map(({ userId }) => userId),
          )

          return {
            project,
            statuses: data.workflowStatuses
              .filter(({ projectId }) => projectId === project.id)
              .sort((left, right) => left.order - right.order),
            assignees: data.users
              .filter(
                ({ id }) => assignableUserIds.has(id) && activeUserIds.has(id),
              )
              .sort((left, right) =>
                left.displayName.localeCompare(right.displayName),
              ),
          }
        })

      return {
        projects,
        labels: data.labels
          .filter((label) => label.workspaceId === workspaceId)
          .sort((left, right) => left.name.localeCompare(right.name)),
      }
    })
  }

  getBoardMetadata(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<BoardMetadata> {
    return this.execute('board.metadata', options, () => {
      this.assertPermission('project:view', workspaceId)
      const data = this.store.read().data

      return {
        projects: data.projects
          .filter(
            (project) =>
              project.workspaceId === workspaceId &&
              openProjectStatuses.has(project.status),
          )
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((project) => ({
            project,
            statuses: data.workflowStatuses
              .filter(({ projectId }) => projectId === project.id)
              .sort((left, right) => left.order - right.order),
          })),
      }
    })
  }

  getIssueActivity(
    issueId: IssueId,
    options?: RequestOptions,
  ): Promise<IssueActivityData> {
    return this.execute('issue.activity', options, () => {
      const data = this.store.read().data
      const issue = data.issues.find(({ id }) => id === issueId)

      if (!issue) throw new EntityNotFoundError('Issue')
      this.assertPermission('issue:view', issue.workspaceId, issue.projectId)

      const comments = data.comments
        .filter(({ issueId: commentIssueId }) => commentIssueId === issueId)
        .sort(compareTimelineEntries)
      const activityEvents = data.activityEvents
        .filter(
          ({ entityKind, entityId }) =>
            entityKind === 'issue' && entityId === issueId,
        )
        .sort(compareTimelineEntries)
      const userIds = new Set([
        ...comments.map(({ authorId }) => authorId),
        ...activityEvents.map(({ actorId }) => actorId),
      ])

      return {
        comments,
        activityEvents,
        users: data.users.filter(({ id }) => userIds.has(id)),
      }
    })
  }

  listNotifications(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<NotificationInbox> {
    return this.execute('notification.list', options, () => {
      this.assertPermission('workspace:view', workspaceId)
      const items = this.store
        .read()
        .data.notifications.filter(
          (notification) =>
            notification.workspaceId === workspaceId &&
            notification.recipientId === this.actorId,
        )
        .sort(
          (left, right) =>
            right.occurredAt.localeCompare(left.occurredAt) ||
            right.id.localeCompare(left.id),
        )

      return {
        items,
        unreadCount: items.filter(({ readAt }) => readAt === null).length,
      }
    })
  }

  markNotificationRead(
    input: MarkNotificationReadInput,
    options?: RequestOptions,
  ): Promise<Notification> {
    return this.execute('notification.mark-read', options, () => {
      const current = this.store.read()
      const index = current.data.notifications.findIndex(({ id }) => id === input.id)
      const notification = current.data.notifications[index]

      if (!notification) throw new EntityNotFoundError('Notification')
      this.assertNotificationRecipient(notification)
      const readAt = input.read ? (notification.readAt ?? this.clock.now()) : null
      if (readAt === notification.readAt) return notification

      const updated = { ...notification, readAt }
      const notifications = [...current.data.notifications]
      notifications[index] = updated
      this.commit(current.version, { ...current.data, notifications })
      return updated
    })
  }

  markAllNotificationsRead(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<number> {
    return this.execute('notification.mark-all-read', options, () => {
      this.assertPermission('workspace:view', workspaceId)
      const current = this.store.read()
      const occurredAt = this.clock.now()
      let updatedCount = 0
      const notifications = current.data.notifications.map((notification) => {
        if (
          notification.workspaceId !== workspaceId ||
          notification.recipientId !== this.actorId ||
          notification.readAt !== null
        ) {
          return notification
        }
        updatedCount += 1
        return { ...notification, readAt: occurredAt }
      })

      if (updatedCount > 0) {
        this.commit(current.version, { ...current.data, notifications })
      }
      return updatedCount
    })
  }

  createComment(
    input: CreateCommentInput,
    options?: RequestOptions,
  ): Promise<Comment> {
    return this.execute('comment.create', options, (requestId) => {
      const current = this.store.read()
      const issue = current.data.issues.find(({ id }) => id === input.issueId)

      if (!issue) throw new EntityNotFoundError('Issue')
      this.assertPermission('comment:create', issue.workspaceId, issue.projectId)

      const body = input.body.trim()
      if (body.length === 0 || body.length > 5_000) {
        throw new InvalidGatewayRequestError(
          'Comments must contain 1 to 5,000 characters.',
        )
      }

      const occurredAt = this.clock.now()
      const comment: Comment = {
        id: this.ids.comment('issue'),
        issueId: issue.id,
        authorId: this.actorId,
        body,
        createdAt: occurredAt,
        editedAt: null,
      }
      const nextData: AtlasDataSnapshot = {
        ...current.data,
        comments: [...current.data.comments, comment],
        activityEvents: [
          ...current.data.activityEvents,
          {
            id: this.ids.activity('comment_created'),
            workspaceId: issue.workspaceId,
            actorId: this.actorId,
            entityKind: 'issue',
            entityId: issue.id,
            action: 'comment.created',
            occurredAt,
            summary: 'Added a comment.',
          },
        ],
        auditEvents: [
          ...current.data.auditEvents,
          {
            id: this.ids.audit('comment_created'),
            workspaceId: issue.workspaceId,
            actorId: this.actorId,
            requestId,
            action: 'comment.created',
            outcome: 'succeeded',
            occurredAt,
            metadata: { issueId: issue.id, commentId: comment.id },
          },
        ],
        notifications:
          issue.assigneeId && issue.assigneeId !== this.actorId
            ? [
                ...current.data.notifications,
                {
                  id: this.ids.notification('comment_created'),
                  workspaceId: issue.workspaceId,
                  recipientId: issue.assigneeId,
                  kind: 'comment',
                  issueId: issue.id,
                  title: `New comment on ${this.issueReference(current.data, issue)}`,
                  body: body.slice(0, 160),
                  occurredAt,
                  readAt: null,
                },
              ]
            : current.data.notifications,
      }

      this.commit(current.version, nextData)
      return comment
    })
  }

  createIssue(
    input: CreateIssueInput,
    options?: RequestOptions,
  ): Promise<Issue> {
    return this.execute('issue.create', options, () => {
      const current = this.store.read()
      const project = current.data.projects.find(({ id }) => id === input.projectId)

      if (project?.workspaceId !== input.workspaceId) {
        throw new InvalidGatewayRequestError(
          'New issues must reference a project in their workspace.',
        )
      }

      if (!openProjectStatuses.has(project.status)) {
        throw new InvalidGatewayRequestError(
          'New issues require a project that is open for work.',
        )
      }

      this.assertPermission('issue:create', input.workspaceId, project.id)
      const { title, description } = this.validateNewIssue(current.data, input)

      const projectIssues = current.data.issues.filter(
        ({ projectId }) => projectId === project.id,
      )
      const occurredAt = this.clock.now()
      const issue: Issue = {
        ...input,
        id: this.ids.issue(project.key.toLocaleLowerCase()),
        title,
        description,
        number:
          projectIssues.reduce(
            (highest, candidate) => Math.max(highest, candidate.number),
            0,
          ) + 1,
        revision: 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }
      const nextData = {
        ...current.data,
        issues: [...current.data.issues, issue],
        notifications:
          issue.assigneeId && issue.assigneeId !== this.actorId
            ? [
                ...current.data.notifications,
                {
                  id: this.ids.notification('issue_assigned'),
                  workspaceId: issue.workspaceId,
                  recipientId: issue.assigneeId,
                  kind: 'assignment' as const,
                  issueId: issue.id,
                  title: `You were assigned ${project.key}-${issue.number.toString()}`,
                  body: issue.title,
                  occurredAt,
                  readAt: null,
                },
              ]
            : current.data.notifications,
      }

      this.commit(current.version, nextData)
      return issue
    })
  }

  updateIssue(
    input: UpdateIssueInput,
    options?: RequestOptions,
  ): Promise<Issue> {
    return this.execute('issue.update', options, (requestId) => {
      const current = this.store.read()
      const issueIndex = current.data.issues.findIndex(({ id }) => id === input.id)
      const issue = current.data.issues[issueIndex]

      if (!issue) {
        throw new EntityNotFoundError('Issue')
      }

      this.assertPermission('issue:update', issue.workspaceId, issue.projectId)

      if (issue.revision !== input.expectedRevision) {
        throw new GatewayConflictError(
          'The issue changed after it was loaded. Refresh and try again.',
        )
      }

      const title = input.changes.title?.trim() ?? issue.title
      if (title.length === 0) {
        throw new InvalidGatewayRequestError('Issue titles may not be empty.')
      }

      const nextStatusId = input.changes.statusId ?? issue.statusId
      const nextStatus = current.data.workflowStatuses.find(
        ({ id }) => id === nextStatusId,
      )
      if (nextStatus?.projectId !== issue.projectId) {
        throw new InvalidGatewayRequestError(
          'Issues must use a status from their project workflow.',
        )
      }

      const occurredAt = this.clock.now()
      const updatedIssue: Issue = {
        ...issue,
        ...input.changes,
        title,
        revision: issue.revision + 1,
        updatedAt: occurredAt,
      }
      const issues = [...current.data.issues]
      issues[issueIndex] = updatedIssue
      const statusChanged = updatedIssue.statusId !== issue.statusId
      const notificationRecipient = updatedIssue.assigneeId
      const assignmentChanged = updatedIssue.assigneeId !== issue.assigneeId
      const nextData: AtlasDataSnapshot = {
        ...current.data,
        issues,
        activityEvents: statusChanged
          ? [
              ...current.data.activityEvents,
              {
                id: this.ids.activity('issue_status_changed'),
                workspaceId: issue.workspaceId,
                actorId: this.actorId,
                entityKind: 'issue',
                entityId: issue.id,
                action: 'issue.status_changed',
                occurredAt,
                summary: `Moved from ${this.statusName(current.data, issue.statusId)} to ${nextStatus.name}.`,
              },
            ]
          : current.data.activityEvents,
        auditEvents: [
          ...current.data.auditEvents,
          {
            id: this.ids.audit('issue_updated'),
            workspaceId: issue.workspaceId,
            actorId: this.actorId,
            requestId,
            action: 'issue.updated',
            outcome: 'succeeded',
            occurredAt,
            metadata: {
              issueId: issue.id,
              fromRevision: issue.revision,
              toRevision: updatedIssue.revision,
            },
          },
        ],
        notifications:
          notificationRecipient && notificationRecipient !== this.actorId
            ? [
                ...current.data.notifications,
                {
                  id: this.ids.notification(
                    assignmentChanged ? 'issue_assigned' : 'issue_updated',
                  ),
                  workspaceId: issue.workspaceId,
                  recipientId: notificationRecipient,
                  kind: assignmentChanged ? 'assignment' : 'issue-update',
                  issueId: issue.id,
                  title: assignmentChanged
                    ? `You were assigned ${this.issueReference(current.data, issue)}`
                    : `${this.issueReference(current.data, issue)} was updated`,
                  body: updatedIssue.title,
                  occurredAt,
                  readAt: null,
                },
              ]
            : current.data.notifications,
      }

      this.commit(current.version, nextData)
      return updatedIssue
    })
  }

  deleteIssue(
    input: DeleteIssueInput,
    options?: RequestOptions,
  ): Promise<void> {
    return this.execute('issue.delete', options, () => {
      const current = this.store.read()
      const issue = current.data.issues.find(({ id }) => id === input.id)

      if (!issue) {
        throw new EntityNotFoundError('Issue')
      }

      this.assertPermission('issue:delete', issue.workspaceId, issue.projectId)

      if (issue.revision !== input.expectedRevision) {
        throw new GatewayConflictError(
          'The issue changed after it was loaded. Refresh and try again.',
        )
      }

      if (current.data.issues.some(({ parentIssueId }) => parentIssueId === issue.id)) {
        throw new GatewayConflictError(
          'An issue with subtasks cannot be deleted until its subtasks are moved.',
        )
      }

      const nextData = {
        ...current.data,
        issues: current.data.issues.filter(({ id }) => id !== issue.id),
        issueRelations: current.data.issueRelations.filter(
          ({ sourceIssueId, targetIssueId }) =>
            sourceIssueId !== issue.id && targetIssueId !== issue.id,
        ),
        comments: current.data.comments.filter(({ issueId }) => issueId !== issue.id),
        activityEvents: current.data.activityEvents.filter(
          ({ entityKind, entityId }) =>
            entityKind !== 'issue' || entityId !== issue.id,
        ),
        notifications: current.data.notifications.filter(
          ({ issueId }) => issueId !== issue.id,
        ),
      }

      this.commit(current.version, nextData)
    })
  }

  private async execute<T>(
    operation: GatewayOperation,
    options: RequestOptions | undefined,
    perform: (requestId: string) => T,
  ): Promise<T> {
    const requestId = this.nextRequestId()
    this.trace(requestId, operation, 'started')

    try {
      await this.simulator.wait(operation, requestId, options?.signal)

      if (options?.signal?.aborted === true) {
        throw new RequestCancelledError()
      }

      const result = perform(requestId)
      this.trace(requestId, operation, 'succeeded')
      return result
    } catch (error) {
      const gatewayError = this.toGatewayError(error)
      this.trace(
        requestId,
        operation,
        gatewayError instanceof RequestCancelledError ? 'cancelled' : 'failed',
        gatewayError,
      )
      throw gatewayError
    }
  }

  private assertPermission(
    permission: Permission,
    workspaceId: WorkspaceId,
    projectId?: ProjectId,
  ): void {
    if (!this.hasPermission(permission, workspaceId, projectId)) {
      throw new ForbiddenGatewayError()
    }
  }

  private assertNotificationRecipient(notification: Notification): void {
    this.assertPermission('workspace:view', notification.workspaceId)
    if (notification.recipientId !== this.actorId) {
      throw new ForbiddenGatewayError()
    }
  }

  private hasPermission(
    permission: Permission,
    workspaceId: WorkspaceId,
    projectId?: ProjectId,
  ): boolean {
    const data = this.store.read().data
    const workspaceMembership = data.memberships.find(
      (membership) =>
        membership.workspaceId === workspaceId && membership.userId === this.actorId,
    )

    if (!workspaceMembership) {
      return false
    }

    const projectMembership = projectId
      ? (data.projectMembers.find(
          (membership) =>
            membership.projectId === projectId && membership.userId === this.actorId,
        ) ?? null)
      : null

    return can({ workspaceMembership, projectMembership }, permission, projectId)
  }

  private validateNewIssue(
    data: AtlasDataSnapshot,
    input: CreateIssueInput,
  ): { readonly title: string; readonly description: string } {
    const title = input.title.trim()
    const description = input.description.trim()
    const status = data.workflowStatuses.find(({ id }) => id === input.statusId)
    const parent = input.parentIssueId
      ? data.issues.find(({ id }) => id === input.parentIssueId)
      : null
    const labelIds = new Set(input.labelIds)
    const labelsAreValid = input.labelIds.every(
      (labelId) =>
        data.labels.find(({ id }) => id === labelId)?.workspaceId === input.workspaceId,
    )
    const assigneeIsValid =
      input.assigneeId === null ||
      (data.memberships.some(
        (membership) =>
          membership.workspaceId === input.workspaceId &&
          membership.userId === input.assigneeId &&
          membership.status === 'active',
      ) &&
        data.projectMembers.some(
          (membership) =>
            membership.projectId === input.projectId &&
            membership.userId === input.assigneeId,
        ))

    if (!['task', 'bug', 'story'].includes(input.type)) {
      throw new InvalidGatewayRequestError('Issue types are not valid.')
    }
    if (!['urgent', 'high', 'medium', 'low', 'none'].includes(input.priority)) {
      throw new InvalidGatewayRequestError('Issue priorities are not valid.')
    }

    if (title.length === 0 || title.length > 160) {
      throw new InvalidGatewayRequestError(
        'Issue titles must contain 1 to 160 characters.',
      )
    }
    if (description.length > 5_000) {
      throw new InvalidGatewayRequestError(
        'Issue descriptions may not exceed 5,000 characters.',
      )
    }
    if (status?.projectId !== input.projectId) {
      throw new InvalidGatewayRequestError(
        'New issues must use a status from their project workflow.',
      )
    }
    if (!assigneeIsValid) {
      throw new InvalidGatewayRequestError(
        'Issue assignees must be active members of the selected project.',
      )
    }
    if (!labelsAreValid || labelIds.size !== input.labelIds.length) {
      throw new InvalidGatewayRequestError(
        'Issue labels must be unique and belong to the issue workspace.',
      )
    }
    if (input.parentIssueId !== null && parent?.projectId !== input.projectId) {
      throw new InvalidGatewayRequestError(
        'Parent issues must belong to the selected project.',
      )
    }
    if (input.dueDate !== null) {
      try {
        isoDate(input.dueDate)
      } catch {
        throw new InvalidGatewayRequestError('Issue due dates must be valid dates.')
      }
    }

    return { title, description }
  }

  private statusName(
    data: AtlasDataSnapshot,
    statusId: Issue['statusId'],
  ): string {
    return (
      data.workflowStatuses.find(({ id }) => id === statusId)?.name ??
      'Unknown status'
    )
  }

  private issueReference(data: AtlasDataSnapshot, issue: Issue): string {
    const key = data.projects.find(({ id }) => id === issue.projectId)?.key ?? 'Issue'
    return `${key}-${issue.number.toString()}`
  }

  private commit(version: number, data: AtlasDataSnapshot): void {
    try {
      this.store.commit(version, data)
    } catch (error) {
      if (error instanceof StaleSnapshotError) {
        throw new GatewayConflictError(
          'Another request committed data first. Refresh and try again.',
        )
      }

      throw error
    }
  }

  private toGatewayError(error: unknown): GatewayError {
    if (error instanceof GatewayError) {
      return error
    }

    if (error instanceof Error) {
      return new InvalidGatewayRequestError(error.message)
    }

    return new InvalidGatewayRequestError('The request failed for an unknown reason.')
  }

  private trace(
    requestId: string,
    operation: GatewayOperation,
    phase: 'cancelled' | 'failed' | 'started' | 'succeeded',
    error?: GatewayError,
  ): void {
    this.tracer.record({
      requestId,
      operation,
      phase,
      occurredAt: this.clock.now(),
      ...(error ? { errorCode: error.code } : {}),
    })
  }

  private nextRequestId(): string {
    this.requestSequence += 1
    return `req_${this.requestSequence.toString().padStart(6, '0')}`
  }
}
