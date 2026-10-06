import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'

export interface BackdropCloseHandlers {
  onMouseDown: (e: ReactMouseEvent<HTMLElement>) => void
  onClick: (e: ReactMouseEvent<HTMLElement>) => void
}

export function useBackdropClose(onClose: () => void): BackdropCloseHandlers {
  const downOnBackdrop = useRef(false)

  const onMouseDown = useCallback((e: ReactMouseEvent<HTMLElement>): void => {
    downOnBackdrop.current = e.target === e.currentTarget
  }, [])

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLElement>): void => {
      if (downOnBackdrop.current && e.target === e.currentTarget) {
        onClose()
      }
      downOnBackdrop.current = false
    },
    [onClose]
  )

  return { onMouseDown, onClick }
}
