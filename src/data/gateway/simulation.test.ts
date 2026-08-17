import { afterEach, describe, expect, it, vi } from 'vitest'

import { RequestCancelledError, type SimulatedGatewayError } from './errors'
import { SimulatedNetwork } from './simulation'

afterEach(() => {
  vi.useRealTimers()
})

describe('SimulatedNetwork', () => {
  it('waits for the configured deterministic latency', async () => {
    vi.useFakeTimers()
    const simulation = new SimulatedNetwork({ latency: () => 250 })
    const request = simulation.wait('issue.list', 'req_000001')
    let settled = false
    void request.then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(249)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(request).resolves.toBeUndefined()
  })

  it('cancels an in-flight delay and removes its timer', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const simulation = new SimulatedNetwork({ latency: () => 5_000 })
    const request = simulation.wait('project.list', 'req_000001', controller.signal)

    controller.abort()

    await expect(request).rejects.toBeInstanceOf(RequestCancelledError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects an already-cancelled request without scheduling work', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      new SimulatedNetwork().wait(
        'issue.get',
        'req_000001',
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(RequestCancelledError)
  })

  it('injects scripted retryable failures after latency', async () => {
    const simulation = new SimulatedNetwork({
      failure: (operation) =>
        operation === 'issue.update' ? 'Temporary write outage.' : null,
    })

    await expect(
      simulation.wait('issue.update', 'req_000002'),
    ).rejects.toMatchObject({
      code: 'simulated-failure',
      retryable: true,
    } satisfies Partial<SimulatedGatewayError>)
  })

  it('rejects invalid latency strategies', async () => {
    const simulation = new SimulatedNetwork({ latency: () => -1 })

    await expect(simulation.wait('issue.list', 'req_000001')).rejects.toThrow(
      RangeError,
    )
  })
})
