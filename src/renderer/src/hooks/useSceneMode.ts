import { useState } from 'react'
import { alertDialog } from '../stores/useDialogStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useDuelStore } from '../stores/useDuelStore'

export function useSceneMode(): {
  toggleSceneMode: () => void
  sceneReturnStepId: string | null
} {
  const [sceneReturnStepId, setSceneReturnStepId] = useState<string | null>(null)

  const toggleSceneMode = (): void => {
    const engine = useDuelEngineStore.getState()
    if (engine.loading) return
    if (engine.isInitialized) {
      const first = engine.timeline[0]
      if (!first) return
      if (engine.currentStepId !== first.id) {
        setSceneReturnStepId(engine.currentStepId)
        void engine.jumpToStep(first.id)
        return
      }
      const target = sceneReturnStepId
        ? engine.timeline.find((node) => node.id === sceneReturnStepId)
        : undefined
      setSceneReturnStepId(null)
      if (target) void engine.jumpToStep(target.id)
      return
    }
    const duel = useDuelStore.getState()
    setSceneReturnStepId(null)
    if (duel.sceneEditing) {
      duel.exitSceneMode()
      return
    }
    if (!duel.enterSceneMode()) {
      void alertDialog(
        '无法进入布景\n当前台本没有可还原的初始场面。可以继续编排，之后的首次操作会自动记录布景。'
      )
    }
  }

  return { toggleSceneMode, sceneReturnStepId }
}
