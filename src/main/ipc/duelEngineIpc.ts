import { ipcMain } from 'electron'
import { duelDirector } from '../services/duel/duel-director'
import { EngineDuelInitParams, Answer, InjectCommand, TimingPolicy } from '@shared/index'

export function registerDuelEngineIpc(): void {
  ipcMain.handle('duel-engine:init', async (_, params: EngineDuelInitParams) => {
    try {
      return await duelDirector.startDuel(params)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:init:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:set-policy', (_, policy: TimingPolicy) => {
    try {
      return duelDirector.setTimingPolicy(policy)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:set-policy:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:submit-answer', (_, answer: Answer) => {
    try {
      return duelDirector.submitAnswer(answer)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:submit-answer:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:inject', (_, command: InjectCommand) => {
    try {
      return duelDirector.inject(command)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:inject:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:jump-to-step', async (_, stepId: string) => {
    try {
      return await duelDirector.jumpToStep(stepId)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:jump-to-step:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:get-timeline', () => {
    return duelDirector.getTimeline()
  })

  ipcMain.handle('duel-engine:get-board-state', () => {
    return duelDirector.getBoardState()
  })

  ipcMain.handle('duel-engine:get-pending-request', () => {
    return duelDirector.getPendingRequest()
  })
}
