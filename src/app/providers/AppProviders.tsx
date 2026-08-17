import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { AppServicesContext } from './app-services-context'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices, type AppServices } from '../services'

const defaultQueryClient = createAtlasQueryClient()
const defaultServices = createAppServices()

export interface AppProvidersProps {
  readonly children: ReactNode
  readonly queryClient?: QueryClient
  readonly services?: AppServices
}

export function AppProviders({
  children,
  queryClient = defaultQueryClient,
  services = defaultServices,
}: AppProvidersProps) {
  return (
    <AppServicesContext value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppServicesContext>
  )
}
