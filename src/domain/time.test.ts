import { describe, expect, it } from 'vitest'

import { InvalidDateValueError, isoDate, isoDateTime } from './time'

describe('canonical domain dates', () => {
  it('accepts canonical UTC timestamps and calendar dates', () => {
    expect(isoDateTime('2026-08-17T01:00:00.000Z')).toBe(
      '2026-08-17T01:00:00.000Z',
    )
    expect(isoDate('2028-02-29')).toBe('2028-02-29')
  })

  it.each([
    ['2026-08-17T03:00:00+02:00', isoDateTime],
    ['not-a-date', isoDateTime],
    ['2026-02-29', isoDate],
    ['17-08-2026', isoDate],
  ])('rejects non-canonical or impossible dates', (value, factory) => {
    expect(() => factory(value)).toThrow(InvalidDateValueError)
  })
})
