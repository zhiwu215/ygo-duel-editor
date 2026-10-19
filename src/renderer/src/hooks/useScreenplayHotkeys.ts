import { useEffect } from 'react'
import { DuelStep } from '@shared/index'

interface UseScreenplayHotkeysParams {
  isScreenplayOpen: boolean
  activeStepIndex: number
  steps: DuelStep[]
  chantPickerCode: number
  setIsScreenplayOpen: (open: boolean) => void
  setSelectedStepId: (id: string | null) => void
}

export function useScreenplayHotkeys({
  isScreenplayOpen,
  activeStepIndex,
  steps,
  chantPickerCode,
  setIsScreenplayOpen,
  setSelectedStepId
}: UseScreenplayHotkeysParams): void {
  useEffect(() => {
    if (!isScreenplayOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (chantPickerCode >= 0) return
        e.preventDefault()
        setIsScreenplayOpen(false)
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeStepIndex > 0) {
          setSelectedStepId(steps[activeStepIndex - 1].id)
        }
      } else if ((e.ctrlKey && e.key === 'ArrowDown') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault()
        if (activeStepIndex < steps.length - 1) {
          setSelectedStepId(steps[activeStepIndex + 1].id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isScreenplayOpen,
    activeStepIndex,
    steps,
    setSelectedStepId,
    chantPickerCode,
    setIsScreenplayOpen
  ])
}
