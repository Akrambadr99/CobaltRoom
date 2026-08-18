import type {
  WorkspaceActivityActorFacet,
  WorkspaceActivityData,
  WorkspaceActivityEntry,
  WorkspaceActivityFacet,
  WorkspaceActivityQuery,
  WorkspaceActivityTarget,
} from './contracts'
import { InvalidGatewayRequestError } from './errors'
import { paginate, validatePage } from './query'
import type { AtlasDataSnapshot } from '../snapshot'
import type { ActivityEvent, EntityKind, IsoDateTime, User } from '../../domain'

const defaultPage = { number: 1, size: 20 } as const

export function buildWorkspaceActivity(
  data: AtlasDataSnapshot,
  query: WorkspaceActivityQuery,
  generatedAt: IsoDateTime,
): WorkspaceActivityData {
  const page = validatePage(query.page ?? defaultPage)
  const action = normalizeExactFilter(query.action, 'Activity actions')
  const entityId = normalizeExactFilter(query.entityId, 'Entity identifiers')
  validateDateRange(query.occurredFrom, query.occurredTo)

  const workspaceEvents = data.activityEvents.filter(
    (event) => event.workspaceId === query.workspaceId,
  )
  const usersById = new Map(data.users.map((user) => [user.id, user]))
  const filtered = workspaceEvents
    .filter(
      (event) =>
        (query.actorId === undefined || event.actorId === query.actorId) &&
        (action === undefined || event.action === action) &&
        (query.entityKind === undefined || event.entityKind === query.entityKind) &&
        (entityId === undefined || event.entityId === entityId) &&
        (query.occurredFrom === undefined || event.occurredAt >= query.occurredFrom) &&
        (query.occurredTo === undefined || event.occurredAt <= query.occurredTo),
    )
    .sort(compareActivity)
  const eventPage = paginate(filtered, page)

  return {
    generatedAt,
    actors: actorFacets(workspaceEvents, usersById),
    actions: valueFacets(workspaceEvents.map(({ action: value }) => value)),
    entityKinds: valueFacets(workspaceEvents.map(({ entityKind }) => entityKind)),
    events: {
      ...eventPage,
      items: eventPage.items.map((event) => toEntry(data, usersById, event)),
    },
  }
}

function compareActivity(left: ActivityEvent, right: ActivityEvent): number {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.id.localeCompare(left.id)
  )
}

function toEntry(
  data: AtlasDataSnapshot,
  usersById: ReadonlyMap<string, User>,
  event: ActivityEvent,
): WorkspaceActivityEntry {
  const actor = usersById.get(event.actorId)
  if (!actor) throw new InvalidGatewayRequestError('Activity actors must exist.')
  return { event, actor, target: resolveTarget(data, event) }
}

function resolveTarget(
  data: AtlasDataSnapshot,
  event: ActivityEvent,
): WorkspaceActivityTarget {
  if (event.entityKind === 'workspace') {
    const workspace = data.workspaces.find(({ id }) => id === event.entityId)
    return { label: workspace?.name ?? 'Removed workspace', href: workspace ? '/' : null }
  }
  if (event.entityKind === 'project') {
    const project = data.projects.find(({ id }) => id === event.entityId)
    return {
      label: project ? `${project.key} · ${project.name}` : 'Removed project',
      href: project ? `/projects/${project.id}` : null,
    }
  }
  if (event.entityKind === 'issue') {
    const issue = data.issues.find(({ id }) => id === event.entityId)
    const project = issue
      ? data.projects.find(({ id }) => id === issue.projectId)
      : undefined
    return {
      label: issue ? `${project?.key ?? 'Issue'}-${issue.number.toString()} · ${issue.title}` : 'Removed issue',
      href: issue ? `/issues/${issue.id}` : null,
    }
  }
  if (event.entityKind === 'comment') {
    const comment = data.comments.find(({ id }) => id === event.entityId)
    const issue = comment
      ? data.issues.find(({ id }) => id === comment.issueId)
      : undefined
    return {
      label: issue ? `Comment on issue ${issue.number.toString()}` : 'Removed comment',
      href: issue ? `/issues/${issue.id}` : null,
    }
  }
  if (event.entityKind === 'member') {
    const membership = data.memberships.find(({ id }) => id === event.entityId)
    const user = membership
      ? data.users.find(({ id }) => id === membership.userId)
      : undefined
    return {
      label: user?.displayName ?? 'Removed member',
      href: membership ? '/administration' : null,
    }
  }
  const invitation = data.workspaceInvitations.find(({ id }) => id === event.entityId)
  return {
    label: invitation?.email ?? 'Removed invitation',
    href: invitation ? '/administration' : null,
  }
}

function actorFacets(
  events: readonly ActivityEvent[],
  usersById: ReadonlyMap<string, User>,
): readonly WorkspaceActivityActorFacet[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.actorId, (counts.get(event.actorId) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => {
    const actor = usersById.get(value)
    if (!actor) throw new InvalidGatewayRequestError('Activity actors must exist.')
    return { value: actor.id, label: actor.displayName, count }
  }).sort((left, right) => left.label.localeCompare(right.label))
}

function valueFacets<TValue extends string>(
  values: readonly TValue[],
): readonly WorkspaceActivityFacet<TValue>[] {
  const counts = new Map<TValue, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
}

function normalizeExactFilter(
  value: string | undefined,
  label: string,
): string | undefined {
  if (value === undefined) return undefined
  if (value.length === 0 || value.trim() !== value || value.length > 200) {
    throw new InvalidGatewayRequestError(
      `${label} must be exact non-empty values no longer than 200 characters.`,
    )
  }
  return value
}

function validateDateRange(from: IsoDateTime | undefined, to: IsoDateTime | undefined): void {
  if (from !== undefined && to !== undefined && from > to) {
    throw new InvalidGatewayRequestError(
      'Activity date ranges require the start to be on or before the end.',
    )
  }
}

export const workspaceActivityEntityKinds: readonly EntityKind[] = [
  'workspace',
  'project',
  'issue',
  'comment',
  'member',
  'invitation',
]
