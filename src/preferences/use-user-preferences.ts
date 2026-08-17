import { useSyncExternalStore } from 'react'

import { useAppServices } from '../app/providers/app-services-context'

export function useUserPreferences() {
  const { preferences } = useAppServices()
  return useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  )
}
