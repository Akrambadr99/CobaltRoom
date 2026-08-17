export type GatewayErrorCode =
  | 'cancelled'
  | 'conflict'
  | 'forbidden'
  | 'invalid-request'
  | 'not-found'
  | 'session-expired'
  | 'simulated-failure'

export class GatewayError extends Error {
  readonly code: GatewayErrorCode
  readonly retryable: boolean

  constructor(code: GatewayErrorCode, message: string, retryable = false) {
    super(message)
    this.name = 'GatewayError'
    this.code = code
    this.retryable = retryable
  }
}

export class RequestCancelledError extends GatewayError {
  constructor() {
    super('cancelled', 'The request was cancelled.')
    this.name = 'RequestCancelledError'
  }
}

export class SimulatedGatewayError extends GatewayError {
  constructor(message: string) {
    super('simulated-failure', message, true)
    this.name = 'SimulatedGatewayError'
  }
}

export class EntityNotFoundError extends GatewayError {
  constructor(entity: string) {
    super('not-found', `${entity} was not found.`)
    this.name = 'EntityNotFoundError'
  }
}

export class GatewayConflictError extends GatewayError {
  constructor(message: string) {
    super('conflict', message)
    this.name = 'GatewayConflictError'
  }
}

export class ForbiddenGatewayError extends GatewayError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('forbidden', message)
    this.name = 'ForbiddenGatewayError'
  }
}

export class SessionExpiredGatewayError extends GatewayError {
  constructor() {
    super(
      'session-expired',
      'Your workspace access changed. Refresh your session before continuing.',
    )
    this.name = 'SessionExpiredGatewayError'
  }
}

export class InvalidGatewayRequestError extends GatewayError {
  constructor(message: string) {
    super('invalid-request', message)
    this.name = 'InvalidGatewayRequestError'
  }
}
