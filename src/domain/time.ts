declare const dateBrand: unique symbol

export type IsoDateTime = string & {
  readonly [dateBrand]: 'IsoDateTime'
}
export type IsoDate = string & {
  readonly [dateBrand]: 'IsoDate'
}

export class InvalidDateValueError extends Error {
  readonly value: string

  constructor(value: string) {
    super(`Invalid canonical date value: ${value}`)
    this.name = 'InvalidDateValueError'
    this.value = value
  }
}

export function isoDateTime(value: string): IsoDateTime {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new InvalidDateValueError(value)
  }

  return value as IsoDateTime
}

export function isoDate(value: string): IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    throw new InvalidDateValueError(value)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new InvalidDateValueError(value)
  }

  return value as IsoDate
}
