import { afterEach, describe, expect, it, vi } from 'vitest'

import { FixedClock, SystemClock } from './clock'
import { isoDateTime } from '../domain'

afterEach(() => {
  vi.useRealTimers()
})

describe('clocks', () => {
  it('advances a fixed clock deterministically', () => {
    const clock = new FixedClock(isoDateTime('2026-01-15T09:00:00.000Z'))

    expect(clock.now()).toBe('2026-01-15T09:00:00.000Z')
    expect(clock.advanceBy(1_500)).toBe('2026-01-15T09:00:01.500Z')
    expect(clock.now()).toBe('2026-01-15T09:00:01.500Z')
  })

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])(
    'rejects an invalid fixed-clock advance',
    (milliseconds) => {
      const clock = new FixedClock(isoDateTime('2026-01-15T09:00:00.000Z'))

      expect(() => clock.advanceBy(milliseconds)).toThrow(RangeError)
    },
  )

  it('canonicalizes the current system time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T10:30:00.125Z'))

    expect(new SystemClock().now()).toBe('2026-08-17T10:30:00.125Z')
  })
})
