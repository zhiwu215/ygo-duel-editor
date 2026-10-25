import { BrowserWindow, ipcMain } from 'electron'
import { duelDirector } from '../services/duel/duel-director'
import { getDuelEngineSupport } from '../services/duel/engineSupport'
import { yrpReplayFileService } from '../services/yrpReplayFileService'
import {
  EngineDuelInitParams,
  EngineSessionDoc,
  Answer,
  InjectCommand,
  TimingPolicy,
  EngineImportReplayResult,
  EngineCardRef
} from '@shared/index'

export function registerDuelEngineIpc(): void {
  ipcMain.handle('duel-engine:support', () => getDuelEngineSupport())

  ipcMain.handle('duel-engine:get-session-doc', () => {
    try {
      return { success: true, doc: duelDirector.exportSessionDoc() }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })

  ipcMain.handle('duel-engine:restore-session', async (_, doc: EngineSessionDoc) => {
    try {
      return { success: true, payload: await duelDirector.importSessionDoc(doc) }
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:restore-session:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })

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

  ipcMain.handle('duel-engine:inject', async (_, command: InjectCommand) => {
    try {
      return await duelDirector.inject(command)
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

  ipcMain.handle('duel-engine:get-pending-request', () => {
    return duelDirector.getPendingRequest()
  })

  ipcMain.handle('duel-engine:get-provenance', (_, ref: EngineCardRef) => {
    try {
      return duelDirector.getProvenance(ref)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:get-provenance:', err)
      return { kind: 'unknown' }
    }
  })

  ipcMain.handle('duel-engine:replace-card', async (_, ref: EngineCardRef, newCode: number) => {
    try {
      return await duelDirector.replaceCard(ref, newCode)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:replace-card:', err)
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('duel-engine:remove-card', async (_, ref: EngineCardRef) => {
    try {
      return await duelDirector.removeCard(ref)
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:remove-card:', err)
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('duel-engine:import-replay', async (event): Promise<EngineImportReplayResult> => {
    const loaded = await yrpReplayFileService.loadYrpFile()
    if (!loaded.success || !loaded.bytes || !loaded.fileName) {
      return { success: false, canceled: loaded.canceled, error: loaded.error }
    }
    BrowserWindow.fromWebContents(event.sender)?.webContents.send(
      'duel-engine:replay-import-starting'
    )
    try {
      const payload = await duelDirector.startReplay(loaded.bytes, loaded.fileName)
      return { success: true, filePath: loaded.filePath, payload }
    } catch (err: unknown) {
      console.error('[duelEngineIpc] Error in duel-engine:import-replay:', err)
      return {
        success: false,
        filePath: loaded.filePath,
        error: err instanceof Error ? err.message : '导入 YRP 录像失败'
      }
    }
  })

  ipcMain.handle('duel-engine:exit-replay', () => {
    duelDirector.exitReplay()
  })
}
