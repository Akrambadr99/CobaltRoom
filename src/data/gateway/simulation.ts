import { RequestCancelledError, SimulatedGatewayError } from './errors'
import type { GatewayOperation } from './tracing'

export type LatencyStrategy = (operation: GatewayOperation) => number
export type FailureStrategy = (
  operation: GatewayOperation,
  requestId: string,
) => string | null

export interface RequestSimulationOptions {
  readonly latency?: LatencyStrategy
  readonly failure?: FailureStrategy
}

export interface RequestSimulator {
  wait(
    operation: GatewayOperation,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<void>
}

const noLatency: LatencyStrategy = () => 0
const noFailure: FailureStrategy = () => null

export class SimulatedNetwork implements RequestSimulator {
  private readonly latency: LatencyStrategy
  private readonly failure: FailureStrategy

  constructor(options: RequestSimulationOptions = {}) {
    this.latency = options.latency ?? noLatency
    this.failure = options.failure ?? noFailure
  }

  async wait(
    operation: GatewayOperation,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const latency = this.latency(operation)

    if (!Number.isSafeInteger(latency) || latency < 0) {
      throw new RangeError('Simulated latency must be a non-negative safe integer.')
    }

    await waitForLatency(latency, signal)

    const failureMessage = this.failure(operation, requestId)
    if (failureMessage !== null) {
      throw new SimulatedGatewayError(failureMessage)
    }
  }
}

function waitForLatency(
  latency: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted === true) {
    return Promise.reject(new RequestCancelledError())
  }

  if (latency === 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
      reject(new RequestCancelledError())
    }
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, latency)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
