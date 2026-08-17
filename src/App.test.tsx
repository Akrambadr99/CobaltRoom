import { describe, expect, it } from 'vitest'

import App from './App'
import { render, screen } from './test/render'

describe('App', () => {
  it('identifies the Atlas Ops foundation with a semantic heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Atlas Ops' }),
    ).toBeVisible()
    expect(screen.getByText('Foundation initialized')).toBeVisible()
  })
})
