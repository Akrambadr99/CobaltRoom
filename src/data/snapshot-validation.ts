import type { AtlasDataSnapshot } from './snapshot'
import {
  assertIssueRelations,
  assertProjectKey,
  assertProjectWorkflow,
  assertUniqueMemberships,
} from '../domain'

export class DataIntegrityError extends Error {
  readonly collection: keyof AtlasDataSnapshot

  constructor(collection: keyof AtlasDataSnapshot, message: string) {
    super(message)
    this.name = 'DataIntegrityError'
    this.collection = collection
  }
}

export function assertValidSnapshot(snapshot: AtlasDataSnapshot): void {
  for (const collection of collectionNames) {
    assertUniqueIds(collection, snapshot[collection])
  }

  assertUniqueMemberships(snapshot.memberships)

  const workspaces = new Set(snapshot.workspaces.map(({ id }) => id))
  const users = new Set(snapshot.users.map(({ id }) => id))
  const projects = new Map(snapshot.projects.map((project) => [project.id, project]))
  const statuses = new Map(
    snapshot.workflowStatuses.map((status) => [status.id, status]),
  )
  const labels = new Map(snapshot.labels.map((label) => [label.id, label]))
  const issues = new Map(snapshot.issues.map((issue) => [issue.id, issue]))
  const projectKeys = new Set<string>()

  for (const membership of snapshot.memberships) {
    if (!workspaces.has(membership.workspaceId) || !users.has(membership.userId)) {
      throw new DataIntegrityError(
        'memberships',
        'Memberships must reference an existing workspace and user.',
      )
    }
  }

  for (const project of snapshot.projects) {
    assertProjectKey(project.key)
    const key = `${project.workspaceId}:${project.key}`

    if (
      !workspaces.has(project.workspaceId) ||
      !users.has(project.leadId) ||
      projectKeys.has(key)
    ) {
      throw new DataIntegrityError(
        'projects',
        'Projects require a workspace, a valid lead, and a unique workspace key.',
      )
    }

    projectKeys.add(key)
    assertProjectWorkflow(
      project,
      snapshot.workflowStatuses.filter(({ projectId }) => projectId === project.id),
    )
  }

  for (const projectMember of snapshot.projectMembers) {
    if (!projects.has(projectMember.projectId) || !users.has(projectMember.userId)) {
      throw new DataIntegrityError(
        'projectMembers',
        'Project members must reference an existing project and user.',
      )
    }
  }

  for (const label of snapshot.labels) {
    if (!workspaces.has(label.workspaceId)) {
      throw new DataIntegrityError('labels', 'Labels must belong to a workspace.')
    }
  }

  for (const issue of snapshot.issues) {
    const project = projects.get(issue.projectId)
    const status = statuses.get(issue.statusId)
    const parent = issue.parentIssueId ? issues.get(issue.parentIssueId) : null
    const hasInvalidLabel = issue.labelIds.some(
      (labelId) => labels.get(labelId)?.workspaceId !== issue.workspaceId,
    )

    if (
      project?.workspaceId !== issue.workspaceId ||
      status?.projectId !== issue.projectId ||
      (issue.assigneeId !== null && !users.has(issue.assigneeId)) ||
      (issue.parentIssueId !== null && parent?.projectId !== issue.projectId) ||
      hasInvalidLabel ||
      issue.number < 1 ||
      !Number.isSafeInteger(issue.number) ||
      issue.revision < 1 ||
      !Number.isSafeInteger(issue.revision)
    ) {
      throw new DataIntegrityError(
        'issues',
        'Issues must have valid project, status, member, label, numbering, and parent references.',
      )
    }
  }

  assertUniqueIssueNumbers(snapshot)
  assertIssueRelations(snapshot.issues, snapshot.issueRelations)

  for (const comment of snapshot.comments) {
    if (!issues.has(comment.issueId) || !users.has(comment.authorId)) {
      throw new DataIntegrityError(
        'comments',
        'Comments must reference an existing issue and author.',
      )
    }
  }

  for (const activity of snapshot.activityEvents) {
    if (!workspaces.has(activity.workspaceId) || !users.has(activity.actorId)) {
      throw new DataIntegrityError(
        'activityEvents',
        'Activity events must reference an existing workspace and actor.',
      )
    }
  }

  for (const audit of snapshot.auditEvents) {
    if (
      !workspaces.has(audit.workspaceId) ||
      (audit.actorId !== null && !users.has(audit.actorId))
    ) {
      throw new DataIntegrityError(
        'auditEvents',
        'Audit events must reference an existing workspace and optional actor.',
      )
    }
  }
}

const collectionNames = [
  'workspaces',
  'users',
  'memberships',
  'projects',
  'projectMembers',
  'workflowStatuses',
  'labels',
  'issues',
  'issueRelations',
  'comments',
  'activityEvents',
  'auditEvents',
] as const satisfies readonly (keyof AtlasDataSnapshot)[]

function assertUniqueIds(
  collection: keyof AtlasDataSnapshot,
  entities: readonly { readonly id: string }[],
): void {
  const ids = new Set<string>()

  for (const entity of entities) {
    if (ids.has(entity.id)) {
      throw new DataIntegrityError(collection, `${collection} ids must be unique.`)
    }

    ids.add(entity.id)
  }
}

function assertUniqueIssueNumbers(snapshot: AtlasDataSnapshot): void {
  const issueNumbers = new Set<string>()

  for (const issue of snapshot.issues) {
    const key = `${issue.projectId}:${issue.number.toString()}`

    if (issueNumbers.has(key)) {
      throw new DataIntegrityError(
        'issues',
        'Issue numbers must be unique within a project.',
      )
    }

    issueNumbers.add(key)
  }
}
