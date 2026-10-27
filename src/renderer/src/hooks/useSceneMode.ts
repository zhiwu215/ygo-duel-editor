import { alertDialog } from '../stores/useDialogStore'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'
import { useDuelStore } from '../stores/useDuelStore'

export function useSceneMode(): {
  toggleSceneMode: () => Promise<void>
} {
  const toggleSceneMode = async (): Promise<void> => {
    const engine = useDuelEngineStore.getState()
    if (engine.loading) return
    const duel = useDuelStore.getState()
    if (duel.sceneEditing) {
      duel.exitSceneMode()
      return
    }
    if (engine.isInitialized) {
      await engine.suspendEngine()
    }
    const targetDuel = useDuelStore.getState()
    if (!targetDuel.enterSceneMode()) {
      void alertDialog(
        '无法进入布景\n当前台本没有可还原的初始场面。可以继续编排，之后的首次操作会自动记录布景。'
      )
    }
  }

  return { toggleSceneMode }
}
