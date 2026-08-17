import { describe, expect, it } from 'vitest'

import {
  GatewayError,
  SimulatedGatewayError,
} from '../../data/gateway/errors'
import { classifyAppError, hasAppErrorKind } from './classify-app-error'

describe('classifyAppError', () => {
  it.each([
    'cancelled',
    'conflict',
    'forbidden',
    'invalid-request',
    'not-found',
    'session-expired',
    'simulated-failure',
  ] as const)('preserves the %s gateway error contract', (code) => {
    const retryable = code === 'simulated-failure'
    const result = classifyAppError(
      new GatewayError(code, `${code} message`, retryable),
    )

    expect(result).toEqual({
      kind: code,
      message: `${code} message`,
      retryable,
    })
  })

  it('classifies untrusted values without accepting code-shaped objects', () => {
    expect(classifyAppError({ code: 'forbidden' })).toEqual({
      kind: 'unexpected',
      message: 'An unexpected error occurred.',
      retryable: false,
    })
    expect(hasAppErrorKind(new Error('offline'), 'forbidden')).toBe(false)
  })

  it('supports recovery decisions across multiple trusted error kinds', () => {
    expect(
      hasAppErrorKind(
        new SimulatedGatewayError('temporary outage'),
        'simulated-failure',
        'cancelled',
      ),
    ).toBe(true)
  })
})
