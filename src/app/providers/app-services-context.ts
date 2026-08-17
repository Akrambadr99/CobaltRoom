import { createContext, useContext } from 'react'

import type { AppServices } from '../services'

export const AppServicesContext = createContext<AppServices | null>(null)

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext)

  if (!services) {
    throw new Error('useAppServices must be used inside AppProviders.')
  }

  return services
}
