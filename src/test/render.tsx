import {
  render as testingLibraryRender,
  type RenderOptions,
} from '@testing-library/react'
import type { ReactNode } from 'react'

function TestProviders({ children }: Readonly<{ children: ReactNode }>) {
  return children
}

function render(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
  return testingLibraryRender(ui, { wrapper: TestProviders, ...options })
}

export * from '@testing-library/react'
export { render }
