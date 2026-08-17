import type { AtlasDataSnapshot } from '../snapshot'
import type {
  GovernanceAuditEntry,
  GovernanceQuery,
  GovernanceReport,
  PageRequest,
} from './contracts'
import { InvalidGatewayRequestError } from './errors'
import type { IsoDateTime } from '../../domain'

const defaultPage = { number: 1, size: 25 } as const

export function buildGovernanceReport(
  data: AtlasDataSnapshot,
  query: GovernanceQuery,
  generatedAt: IsoDateTime,
): GovernanceReport {
  const page = validateGovernancePage(query.page ?? defaultPage)
  const action = normalizeAction(query.action)
  const entityId = normalizeExactFilter(query.entityId, 'Entity identifiers')
  const requestId = normalizeExactFilter(query.requestId, 'Request identifiers')
  validateDateRange(query.occurredFrom, query.occurredTo)
  const workspaceEvents = data.auditEvents.filter(
    (event) => event.workspaceId === query.workspaceId,
  )
  const filteredEvents = workspaceEvents
    .filter(
      (event) =>
        (action === undefined || event.action === action) &&
        (query.outcome === undefined || event.outcome === query.outcome) &&
        (query.actor === undefined ||
          (query.actor === 'system'
            ? event.actorId === null
            : event.actorId === query.actor)) &&
        (entityId === undefined || eventEntityId(event) === entityId) &&
        (requestId === undefined || event.requestId === requestId) &&
        (query.occurredFrom === undefined || event.occurredAt >= query.occurredFrom) &&
        (query.occurredTo === undefined || event.occurredAt <= query.occurredTo),
    )
    .sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        right.id.localeCompare(left.id),
    )
  const usersById = new Map(data.users.map((user) => [user.id, user.displayName]))
  const offset = (page.number - 1) * page.size
  const entries: GovernanceAuditEntry[] = filteredEvents
    .slice(offset, offset + page.size)
    .map((event) => toGovernanceEntry(event, usersById))

  return {
    generatedAt,
    totalEvents: workspaceEvents.length,
    succeededEvents: countOutcome(workspaceEvents, 'succeeded'),
    rejectedEvents: countOutcome(workspaceEvents, 'rejected'),
    failedEvents: countOutcome(workspaceEvents, 'failed'),
    actions: [...countActions(workspaceEvents)].sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value),
    ),
    actors: countActors(workspaceEvents, usersById),
    events: {
      items: entries,
      pageNumber: page.number,
      pageSize: page.size,
      pageCount: Math.ceil(filteredEvents.length / page.size),
      totalItems: filteredEvents.length,
    },
    exportRows: entries.map(({ event, actorName, entityId }) => ({
      occurredAt: event.occurredAt,
      action: event.action,
      actor: actorName,
      outcome: event.outcome,
      entityId: entityId ?? '',
      requestId: event.requestId,
    })),
  }
}

function toGovernanceEntry(
  event: AtlasDataSnapshot['auditEvents'][number],
  usersById: ReadonlyMap<string, string>,
): GovernanceAuditEntry {
  return {
    event,
    actorName:
      event.actorId === null
        ? 'System'
        : (usersById.get(event.actorId) ?? 'Unknown member'),
    entityId: eventEntityId(event),
  }
}

function eventEntityId(event: AtlasDataSnapshot['auditEvents'][number]): string | null {
  const entry = Object.entries(event.metadata).find(
    ([key, value]) => key.endsWith('Id') && typeof value === 'string',
  )
  return typeof entry?.[1] === 'string' ? entry[1] : null
}

function validateGovernancePage(page: PageRequest): PageRequest {
  if (
    !Number.isSafeInteger(page.number) ||
    page.number < 1 ||
    !Number.isSafeInteger(page.size) ||
    page.size < 1 ||
    page.size > 100
  ) {
    throw new InvalidGatewayRequestError(
      'Page numbers must be positive integers and page sizes must be between 1 and 100.',
    )
  }
  return page
}

function normalizeAction(action: string | undefined): string | undefined {
  if (action === undefined) return undefined
  const normalized = action.trim()
  if (normalized.length === 0 || normalized !== action) {
    throw new InvalidGatewayRequestError('Audit actions must be exact non-empty values.')
  }
  return normalized
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
      'Audit date ranges require the start to be on or before the end.',
    )
  }
}

function countOutcome(
  events: AtlasDataSnapshot['auditEvents'],
  outcome: AtlasDataSnapshot['auditEvents'][number]['outcome'],
): number {
  return events.filter((event) => event.outcome === outcome).length
}

function countActions(events: AtlasDataSnapshot['auditEvents']) {
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.action, (counts.get(event.action) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => ({ value, count }))
}

function countActors(
  events: AtlasDataSnapshot['auditEvents'],
  usersById: ReadonlyMap<string, string>,
) {
  const counts = new Map<string, number>()
  for (const event of events) {
    const value = event.actorId ?? 'system'
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({
      value: value as GovernanceReport['actors'][number]['value'],
      label: value === 'system' ? 'System' : (usersById.get(value) ?? 'Unknown member'),
      count,
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}
