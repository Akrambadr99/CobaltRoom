import {
  GatewayError,
  type GatewayErrorCode,
} from '../../data/gateway/errors'

export type AppErrorKind = GatewayErrorCode | 'unexpected'

export interface AppErrorClassification {
  readonly kind: AppErrorKind
  readonly message: string
  readonly retryable: boolean
}

export function classifyAppError(error: unknown): AppErrorClassification {
  if (error instanceof GatewayError) {
    return {
      kind: error.code,
      message: error.message,
      retryable: error.retryable,
    }
  }

  return {
    kind: 'unexpected',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: false,
  }
}

export function hasAppErrorKind(
  error: unknown,
  ...kinds: readonly AppErrorKind[]
): boolean {
  return kinds.includes(classifyAppError(error).kind)
}
