import { assertValidSnapshot } from './snapshot-validation'
import type { AtlasDataSnapshot, VersionedSnapshot } from './snapshot'

export class StaleSnapshotError extends Error {
  readonly expectedVersion: number
  readonly actualVersion: number

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Cannot commit snapshot version ${expectedVersion.toString()}; current version is ${actualVersion.toString()}.`,
    )
    this.name = 'StaleSnapshotError'
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}

export class InMemoryDataStore {
  private data: AtlasDataSnapshot
  private version = 0

  constructor(seed: AtlasDataSnapshot) {
    assertValidSnapshot(seed)
    this.data = structuredClone(seed)
  }

  read(): VersionedSnapshot {
    return {
      version: this.version,
      data: structuredClone(this.data),
    }
  }

  commit(
    expectedVersion: number,
    nextData: AtlasDataSnapshot,
  ): VersionedSnapshot {
    if (expectedVersion !== this.version) {
      throw new StaleSnapshotError(expectedVersion, this.version)
    }

    assertValidSnapshot(nextData)
    this.data = structuredClone(nextData)
    this.version += 1
    return this.read()
  }
}
