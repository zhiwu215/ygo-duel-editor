import { ipcMain } from 'electron'
import {
  DuelPuzzleState,
  DuelTestSettings,
  EngineExportReplayParams,
  EngineExportReplayResult,
  EngineOpenReplayResult,
  ReplayDeleteResult,
  ReplayFileListResult
} from '@shared/index'
import { ygoproLauncher } from '../services/ygoproLauncher'
import { luaFileIo } from '../services/luaFileIo'
import { screenplayMarkdownService } from '../services/screenplayMarkdownService'

export function registerProjectIpc(): void {
  ipcMain.handle('file:export-lua', async (_, state: DuelPuzzleState, targetPath?: string) => {
    return luaFileIo.exportLuaFile(state, targetPath)
  })

  ipcMain.handle(
    'file:test-in-ygo',
    (_, state: DuelPuzzleState, force?: boolean, test?: DuelTestSettings) => {
      return ygoproLauncher.testInGame(state, force ?? false, test)
    }
  )

  ipcMain.handle('file:import-lua', async () => {
    return luaFileIo.importLuaFile()
  })

  ipcMain.handle('file:export-screenplay-md', async (_, state: DuelPuzzleState) => {
    return screenplayMarkdownService.exportScreenplayFile(state)
  })

  ipcMain.handle(
    'duel:export-replay',
    async (_, params: EngineExportReplayParams): Promise<EngineExportReplayResult> => {
      return ygoproLauncher.exportReplay(params)
    }
  )

  ipcMain.handle(
    'duel:open-replay',
    async (_, filePath: string): Promise<EngineOpenReplayResult> => {
      return ygoproLauncher.openReplay(filePath)
    }
  )

  ipcMain.handle('duel:list-replays', async (): Promise<ReplayFileListResult> => {
    return ygoproLauncher.listReplays()
  })

  ipcMain.handle(
    'duel:delete-replays',
    async (_, fileNames: string[]): Promise<ReplayDeleteResult> => {
      return ygoproLauncher.deleteReplays(fileNames)
    }
  )
}
