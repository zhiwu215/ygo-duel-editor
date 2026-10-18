import { ipcMain } from 'electron'
import { duelDirector } from '../services/duel/duel-director'
import { fileService } from '../services/fileService'
import {
  EngineDuelInitParams,
  EngineCardRef,
  Answer,
  InjectCommand,
  TimingPolicy,
  EngineSessionFileResult,
  EngineSessionImportResult
} from '@shared/index'

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

  ipcMain.handle('duel-engine:provenance', (_, ref: EngineCardRef) => {
    try {
      return duelDirector.getProvenance(ref)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:provenance:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:replace-card', (_, ref: EngineCardRef, newCode: number) => {
    try {
      return duelDirector.replaceCard(ref, newCode)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:replace-card:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('duel-engine:remove-card', (_, ref: EngineCardRef) => {
    try {
      return duelDirector.removeCard(ref)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:remove-card:', err)
      throw new Error(err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(
    'duel-engine:export-session',
    async (): Promise<EngineSessionFileResult> => {
      try {
        return await fileService.exportSessionDocFile(duelDirector.exportSessionDoc())
      } catch (err: unknown) {
        console.error('[duelEngineIpc] Error in duel-engine:export-session:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : '导出对局剧本失败'
        }
      }
    }
  )

  ipcMain.handle(
    'duel-engine:import-session',
    async (): Promise<EngineSessionImportResult> => {
      const loaded = await fileService.loadSessionDocFile()
      if (!loaded.success || !loaded.doc) {
        return { success: false, canceled: loaded.canceled, error: loaded.error }
      }
      try {
        const imported = await duelDirector.importSessionDoc(loaded.doc)
        return {
          success: true,
          filePath: loaded.filePath,
          boardState: imported.boardState,
          pendingRequest: imported.pendingRequest,
          timeline: imported.timeline,
          currentStepId: imported.currentStepId,
          timingPolicy: loaded.doc.timingPolicy
        }
      } catch (err: unknown) {
        console.error('[duelEngineIpc] Error in duel-engine:import-session:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : '导入对局剧本失败'
        }
      }
    }
  )
}
