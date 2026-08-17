import userEvent from '@testing-library/user-event'
import { useMemo } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useKeyboardShortcuts } from './keyboard-shortcuts'
import { render, screen } from '../test/render'

describe('keyboard shortcut registry', () => {
  it('matches primary-modifier commands and ignores editable targets', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()

    function Harness() {
      const shortcuts = useMemo(
        () => [{ id: 'commands.open', key: 'k', controlOrMeta: true, handler }],
        [],
      )
      useKeyboardShortcuts(shortcuts)
      return <input aria-label="Editor" />
    }

    render(<Harness />)
    await user.keyboard('{Control>}k{/Control}')
    expect(handler).toHaveBeenCalledOnce()

    await user.click(screen.getByLabelText('Editor'))
    await user.keyboard('{Control>}k{/Control}')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('allows explicitly scoped shortcuts inside editable controls', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()

    function Harness() {
      const shortcuts = useMemo(
        () => [{ id: 'editor.save', key: 's', controlOrMeta: true, allowInEditable: true, handler }],
        [],
      )
      useKeyboardShortcuts(shortcuts)
      return <textarea aria-label="Editor" />
    }

    render(<Harness />)
    await user.click(screen.getByLabelText('Editor'))
    await user.keyboard('{Control>}s{/Control}')
    expect(handler).toHaveBeenCalledOnce()
  })
})
