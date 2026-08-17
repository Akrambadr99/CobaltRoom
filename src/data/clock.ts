import { isoDateTime, type IsoDateTime } from '../domain'

export interface Clock {
  now(): IsoDateTime
}

export class SystemClock implements Clock {
  now(): IsoDateTime {
    return isoDateTime(new Date().toISOString())
  }
}

export class FixedClock implements Clock {
  private currentTime: number

  constructor(initialTime: IsoDateTime) {
    this.currentTime = Date.parse(initialTime)
  }

  now(): IsoDateTime {
    return isoDateTime(new Date(this.currentTime).toISOString())
  }

  advanceBy(milliseconds: number): IsoDateTime {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new RangeError('Clock advances must be non-negative safe integers.')
    }

    this.currentTime += milliseconds
    return this.now()
  }
}
