import { useEffect, useRef } from 'react'

export function useConfirmationFocus(confirming: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmationRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(confirming)

  useEffect(() => {
    if (confirming) {
      confirmationRef.current?.focus()
    } else if (wasConfirming.current) {
      triggerRef.current?.focus()
    }

    wasConfirming.current = confirming
  }, [confirming])

  return { confirmationRef, triggerRef }
}
