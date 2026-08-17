import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ModalDialog } from './ModalDialog'
import { render, screen } from '../../test/render'

describe('ModalDialog', () => {
  it('contains keyboard focus, closes on Escape, and restores the trigger', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    function Example() {
      const [open, setOpen] = useState(false)
      return (
        <div className="app-shell">
          <button
            type="button"
            onClick={() => {
              setOpen(true)
            }}
          >
            Open editor
          </button>
          {open ? (
            <ModalDialog
              titleId="dialog-title"
              onRequestClose={() => {
                onClose()
                setOpen(false)
              }}
            >
              <h2 id="dialog-title">Editor</h2>
              <input aria-label="First field" />
              <button type="button">Last action</button>
            </ModalDialog>
          ) : null}
        </div>
      )
    }

    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Open editor' })
    await user.click(trigger)
    expect(trigger.closest('.app-shell')).toHaveAttribute('inert')
    expect(screen.getByLabelText('First field')).toHaveFocus()

    screen.getByRole('button', { name: 'Last action' }).focus()
    await user.keyboard('{Tab}')
    expect(screen.getByLabelText('First field')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    expect(trigger.closest('.app-shell')).not.toHaveAttribute('inert')
    expect(trigger).toHaveFocus()
  })
})
