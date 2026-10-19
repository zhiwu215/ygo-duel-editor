import { ipcMain } from 'electron'
import { DuelPuzzleState, EngineExportReplayParams, EngineExportReplayResult } from '@shared/index'
import { projectFileService } from '../services/projectFileService'
import { projectSeriesService } from '../services/projectSeriesService'
import { ygoproLauncher } from '../services/ygoproLauncher'
import { luaFileIo } from '../services/luaFileIo'
import { sessionDocFileService } from '../services/sessionDocFileService'

export function registerProjectIpc(): void {
  ipcMain.handle('file:export-lua', async (_, state: DuelPuzzleState, targetPath?: string) => {
    return luaFileIo.exportLuaFile(state, targetPath)
  })

  ipcMain.handle('file:test-in-ygo', (_, state: DuelPuzzleState) => {
    return ygoproLauncher.testInGame(state)
  })

  ipcMain.handle('file:import-lua', async () => {
    return luaFileIo.importLuaFile()
  })

  ipcMain.handle('file:export-screenplay-md', async (_, state: DuelPuzzleState) => {
    return sessionDocFileService.exportScreenplayFile(state)
  })

  ipcMain.handle('file:save-to-library', async (_, state: DuelPuzzleState) => {
    return projectFileService.saveProjectToLibrary(state)
  })

  ipcMain.handle(
    'duel:export-replay',
    async (_, params: EngineExportReplayParams): Promise<EngineExportReplayResult> => {
      return ygoproLauncher.exportReplay(params)
    }
  )

  ipcMain.handle('file:save-project', async (_, state: DuelPuzzleState) => {
    return projectFileService.saveProjectFile(state)
  })

  ipcMain.handle(
    'file:save-project-to-path',
    async (_, filePath: string, state: DuelPuzzleState) => {
      return projectFileService.saveProjectToPath(filePath, state)
    }
  )

  ipcMain.handle('file:load-project', async () => {
    return projectFileService.loadProjectFile()
  })

  ipcMain.handle('file:get-project-list', async () => {
    return projectFileService.getProjectList()
  })

  ipcMain.handle('file:load-project-by-path', async (_, filePath: string) => {
    return projectFileService.loadProjectByPath(filePath)
  })

  ipcMain.handle('file:delete-project-file', async (_, filePath: string) => {
    return projectFileService.deleteProjectFile(filePath)
  })

  ipcMain.handle('file:duplicate-project-file', async (_, filePath: string) => {
    return projectFileService.duplicateProjectFile(filePath)
  })

  ipcMain.handle('file:reveal-file', async (_, filePath: string) => {
    return projectFileService.revealFileInFolder(filePath)
  })

  ipcMain.handle('file:get-projects-dir', async () => {
    return projectFileService.getProjectsDirectory()
  })

  ipcMain.handle('file:open-projects-dir', async () => {
    return projectFileService.openProjectsDirectory()
  })

  ipcMain.handle('file:select-projects-dir', async () => {
    return projectFileService.selectProjectsDirectory()
  })

  ipcMain.handle('file:create-project-series', async (_, name: string) => {
    return projectSeriesService.createProjectSeries(name)
  })

  ipcMain.handle('file:rename-project-series', async (_, oldName: string, newName: string) => {
    return projectSeriesService.renameProjectSeries(oldName, newName)
  })

  ipcMain.handle('file:delete-project-series', async (_, name: string) => {
    return projectSeriesService.deleteProjectSeries(name)
  })

  ipcMain.handle('file:set-project-series', async (_, filePath: string, series: string | null) => {
    return projectSeriesService.setProjectSeries(filePath, series)
  })
}
