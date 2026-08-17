export interface PreferenceStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

export class BrowserPreferenceStorage implements PreferenceStorage {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  get(key: string): string | null {
    return this.storage.getItem(key)
  }

  set(key: string, value: string): void {
    this.storage.setItem(key, value)
  }
}

export class MemoryPreferenceStorage implements PreferenceStorage {
  private readonly values = new Map<string, string>()

  constructor(initialValues: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value)
    }
  }

  get(key: string): string | null {
    return this.values.get(key) ?? null
  }

  set(key: string, value: string): void {
    this.values.set(key, value)
  }
}
