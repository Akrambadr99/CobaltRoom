import type { GatewayErrorCode } from './errors'
import type { IsoDateTime } from '../../domain'

export type GatewayOperation =
  | 'board.metadata'
  | 'comment.create'
  | 'issue.activity'
  | 'issue.create'
  | 'issue.delete'
  | 'issue.get'
  | 'issue.creation-metadata'
  | 'issue.list'
  | 'issue.update'
  | 'notification.list'
  | 'notification.mark-all-read'
  | 'notification.mark-read'
  | 'project.list'

export type RequestPhase = 'cancelled' | 'failed' | 'started' | 'succeeded'

export interface RequestTraceEvent {
  readonly requestId: string
  readonly operation: GatewayOperation
  readonly phase: RequestPhase
  readonly occurredAt: IsoDateTime
  readonly errorCode?: GatewayErrorCode
}

export interface RequestTracer {
  record(event: RequestTraceEvent): void
}

export class InMemoryRequestTracer implements RequestTracer {
  private readonly events: RequestTraceEvent[] = []

  record(event: RequestTraceEvent): void {
    this.events.push(structuredClone(event))
  }

  read(): readonly RequestTraceEvent[] {
    return structuredClone(this.events)
  }

  clear(): void {
    this.events.length = 0
  }
}

export const noopRequestTracer: RequestTracer = {
  record: () => undefined,
}
