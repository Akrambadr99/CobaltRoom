import { useEffect, useRef, type ReactNode } from 'react'

import './modal-dialog.css'

interface ModalDialogProps {
  readonly children: ReactNode
  readonly descriptionId?: string
  readonly onRequestClose: () => void
  readonly titleId: string
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function ModalDialog({
  children,
  descriptionId,
  onRequestClose,
  titleId,
}: ModalDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      focusableSelector,
    )
    firstFocusable?.focus()

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onRequestClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onRequestClose])

  return (
    <div className="modal-backdrop">
      <div
        ref={panelRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {children}
      </div>
    </div>
  )
}
