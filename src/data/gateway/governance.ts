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
  const workspaceEvents = data.auditEvents.filter(
    (event) => event.workspaceId === query.workspaceId,
  )
  const filteredEvents = workspaceEvents
    .filter(
      (event) =>
        (action === undefined || event.action === action) &&
        (query.outcome === undefined || event.outcome === query.outcome),
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
    .map((event) => ({
      event,
      actorName:
        event.actorId === null
          ? 'System'
          : (usersById.get(event.actorId) ?? 'Unknown member'),
    }))

  return {
    generatedAt,
    totalEvents: workspaceEvents.length,
    succeededEvents: countOutcome(workspaceEvents, 'succeeded'),
    rejectedEvents: countOutcome(workspaceEvents, 'rejected'),
    failedEvents: countOutcome(workspaceEvents, 'failed'),
    actions: [...countActions(workspaceEvents)].sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value),
    ),
    events: {
      items: entries,
      pageNumber: page.number,
      pageSize: page.size,
      pageCount: Math.ceil(filteredEvents.length / page.size),
      totalItems: filteredEvents.length,
    },
  }
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
