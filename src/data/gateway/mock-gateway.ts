import type {
  AtlasGateway,
  CreateIssueInput,
  DeleteIssueInput,
  IssueQuery,
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
  type Issue,
  type IssueId,
  type Permission,
  type Project,
  type ProjectId,
  type UserId,
  type WorkspaceId,
} from '../../domain'

export interface MockAtlasGatewayOptions {
  readonly store: InMemoryDataStore
  readonly actorId: UserId
  readonly clock?: Clock
  readonly idGenerator?: DeterministicIdGenerator
  readonly simulator?: RequestSimulator
  readonly tracer?: RequestTracer
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

      this.assertPermission('issue:create', input.workspaceId, project.id)

      const title = input.title.trim()
      if (title.length === 0) {
        throw new InvalidGatewayRequestError('Issue titles may not be empty.')
      }

      const projectIssues = current.data.issues.filter(
        ({ projectId }) => projectId === project.id,
      )
      const issue: Issue = {
        ...input,
        id: this.ids.issue(project.key.toLocaleLowerCase()),
        title,
        number:
          projectIssues.reduce(
            (highest, candidate) => Math.max(highest, candidate.number),
            0,
          ) + 1,
        revision: 1,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      }
      const nextData = {
        ...current.data,
        issues: [...current.data.issues, issue],
      }

      this.commit(current.version, nextData)
      return issue
    })
  }

  updateIssue(
    input: UpdateIssueInput,
    options?: RequestOptions,
  ): Promise<Issue> {
    return this.execute('issue.update', options, () => {
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

      const updatedIssue: Issue = {
        ...issue,
        ...input.changes,
        title,
        revision: issue.revision + 1,
        updatedAt: this.clock.now(),
      }
      const issues = [...current.data.issues]
      issues[issueIndex] = updatedIssue

      this.commit(current.version, { ...current.data, issues })
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
      }

      this.commit(current.version, nextData)
    })
  }

  private async execute<T>(
    operation: GatewayOperation,
    options: RequestOptions | undefined,
    perform: () => T,
  ): Promise<T> {
    const requestId = this.nextRequestId()
    this.trace(requestId, operation, 'started')

    try {
      await this.simulator.wait(operation, requestId, options?.signal)

      if (options?.signal?.aborted === true) {
        throw new RequestCancelledError()
      }

      const result = perform()
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
    const data = this.store.read().data
    const workspaceMembership = data.memberships.find(
      (membership) =>
        membership.workspaceId === workspaceId && membership.userId === this.actorId,
    )

    if (!workspaceMembership) {
      throw new ForbiddenGatewayError()
    }

    const projectMembership = projectId
      ? (data.projectMembers.find(
          (membership) =>
            membership.projectId === projectId && membership.userId === this.actorId,
        ) ?? null)
      : null

    if (!can({ workspaceMembership, projectMembership }, permission, projectId)) {
      throw new ForbiddenGatewayError()
    }
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
