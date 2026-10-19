import { dialog, BrowserWindow, app } from 'electron'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  DuelPuzzleState,
  generateLuaScript,
  EngineExportReplayParams,
  EngineExportReplayResult
} from '@shared/index'
import { configService } from './configService'
import { duelDirector } from './duel/duel-director'
import { buildYrpSingleFile, DUEL_PSEUDO_SHUFFLE } from './yrpWriter'
import { sanitizeFileName, sanitizeProjectFileName } from '../utils/fileName'
import { toErrorMessage } from '../utils/errors'
import { completeCardDetails } from './completeCardDetails'

export class YgoproLauncher {
  public async selectGameDirectory(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择 YGO 游戏主目录 (即 ygopro.exe 所在的文件夹，选择后自动读取其中的 cards.cdb)',
      properties: ['openDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  public async selectExtraCdb(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择附加卡库 (.cdb，例如动漫卡库)',
      properties: ['openFile'],
      filters: [{ name: '卡库文件', extensions: ['cdb'] }]
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  public locateCardsCdb(gameDir: string): string | null {
    const candidates = [join(gameDir, 'cards.cdb'), join(gameDir, 'expansions', 'cards.cdb')]
    for (const p of candidates) {
      if (existsSync(p)) {
        return p
      }
    }
    return null
  }

  private locateYgoproExe(gameDir: string): string | null {
    const candidates = [join(gameDir, 'ygopro.exe'), join(gameDir, 'ygopro')]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    try {
      for (const file of readdirSync(gameDir)) {
        if (/(ygo|gopro|pro)\.exe$/i.test(file)) {
          return join(gameDir, file)
        }
      }
    } catch {
      return null
    }
    return null
  }

  public testInYgo(state: DuelPuzzleState): {
    success: boolean
    exePath?: string
    scriptPath?: string
    errorCode?: 'no-game-directory' | 'ygopro-not-found'
    error?: string
  } {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }

    const exePath = this.locateYgoproExe(gameDir)
    if (!exePath) {
      return { success: false, errorCode: 'ygopro-not-found', error: gameDir }
    }

    try {
      completeCardDetails(state)
      const luaContent = generateLuaScript(state)

      const dir = join(app.getPath('userData'), 'ygo-test')
      mkdirSync(dir, { recursive: true })
      const name = sanitizeFileName(state.title).trim() || 'puzzle'
      const scriptPath = join(dir, `${name}.lua`)
      writeFileSync(scriptPath, luaContent, 'utf-8')

      const child = spawn(exePath, ['-s', scriptPath], {
        cwd: gameDir,
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      console.log(`[FileService] Launched ${exePath} -s ${scriptPath}`)
      return { success: true, exePath, scriptPath }
    } catch (err) {
      console.error('[FileService] Test in ygo failed:', err)
      return { success: false, error: toErrorMessage(err) }
    }
  }

  public async exportReplay(params: EngineExportReplayParams): Promise<EngineExportReplayResult> {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }
    const exePath = this.locateYgoproExe(gameDir)
    if (!exePath) {
      return { success: false, errorCode: 'ygopro-not-found', error: gameDir }
    }
    const responses = duelDirector.getAllTimelineResponses()
    if (responses.length === 0) {
      return {
        success: false,
        errorCode: 'no-actions',
        error: '还没有任何经过引擎的操作记录，无法进行录像导出'
      }
    }
    try {
      completeCardDetails(params.state)
      const luaContent = generateLuaScript(params.state, { forReplay: true })
      const name = sanitizeProjectFileName(params.state.title || '未命名对局')

      const singleDir = join(gameDir, 'single')
      const replayDir = join(gameDir, 'replay')
      mkdirSync(singleDir, { recursive: true })
      mkdirSync(replayDir, { recursive: true })
      const luaPath = join(singleDir, `${name}.lua`)
      const yrpPath = join(replayDir, `${name}.yrp`)
      writeFileSync(luaPath, luaContent, 'utf-8')

      const turnPlayer = (params.state.turnPlayer ?? 0) as 0 | 1
      const duelists = params.state.duelists ?? []
      const names: [string, string] = [
        duelists.find((d) => d.team === turnPlayer)?.name || `Player ${turnPlayer + 1}`,
        duelists.find((d) => d.team === ((1 - turnPlayer) as 0 | 1))?.name ||
          `Player ${2 - turnPlayer}`
      ]
      const yrpBytes = buildYrpSingleFile({
        names,
        startLp: Number(params.state.players[0]?.lp ?? 8000),
        startHand: Number(params.state.players[0]?.startHand ?? 0),
        drawCount: Number(params.state.players[0]?.maxHand ?? 0),
        opt: DUEL_PSEUDO_SHUFFLE,
        scriptFile: `./single/${name}.lua`,
        responses
      })
      writeFileSync(yrpPath, Buffer.from(yrpBytes))

      let launched = false
      if (params.launch !== false) {
        const child = spawn(exePath, ['-r', yrpPath], {
          cwd: gameDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        launched = true
      }
      return { success: true, luaPath, yrpPath, launched }
    } catch (err) {
      return {
        success: false,
        errorCode: 'replay-failed',
        error: toErrorMessage(err)
      }
    }
  }
}

export const ygoproLauncher = new YgoproLauncher()
