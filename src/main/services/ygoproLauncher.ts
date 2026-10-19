import { dialog, BrowserWindow, app } from 'electron'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { YGOProYrp } from 'ygopro-yrp-encode'
import { YGOProYrp3d } from 'ygopro-yrp3d-encode'
import { YGOProMessages, YGOProStocReplay } from 'ygopro-msg-encode'
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

  public detectGameType(dir: string): 'ygopro' | 'mdpro3' | null {
    if (existsSync(join(dir, 'MDPro3.exe'))) return 'mdpro3'
    if (this.locateYgoproExe(dir)) return 'ygopro'
    return null
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

  public locateCardsCdb(gameDir: string, gameType?: 'ygopro' | 'mdpro3'): string | null {
    if (gameType === 'mdpro3') {
      const localesDir = join(gameDir, 'Data', 'locales')
      const zhCn = join(localesDir, 'zh-CN', 'cards.cdb')
      if (existsSync(zhCn)) return zhCn
      try {
        for (const entry of readdirSync(localesDir)) {
          const candidate = join(localesDir, entry, 'cards.cdb')
          if (existsSync(candidate)) return candidate
        }
      } catch {
        return null
      }
      return null
    }
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

  public testInGame(state: DuelPuzzleState): {
    success: boolean
    exePath?: string
    scriptPath?: string
    errorCode?: 'no-game-directory' | 'game-not-found'
    error?: string
  } {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }
    const gameType = configService.get().gameType ?? 'ygopro'

    if (gameType === 'mdpro3') {
      const exePath = join(gameDir, 'MDPro3.exe')
      if (!existsSync(exePath)) {
        return { success: false, errorCode: 'game-not-found', error: gameDir }
      }
      try {
        completeCardDetails(state)
        const luaContent = generateLuaScript(state)

        const puzzleDir = join(gameDir, 'Puzzle')
        mkdirSync(puzzleDir, { recursive: true })
        const name =
          (sanitizeFileName(state.title).trim() || 'puzzle').replace(/\s+/g, '_') || 'puzzle'
        const scriptPath = join(puzzleDir, `${name}.lua`)
        writeFileSync(scriptPath, luaContent, 'utf-8')

        const child = spawn(exePath, ['-s', name], {
          cwd: gameDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()

        console.log(`[FileService] Launched ${exePath} -s ${name}`)
        return { success: true, exePath, scriptPath }
      } catch (err) {
        console.error('[FileService] Test in MDPro3 failed:', err)
        return { success: false, error: toErrorMessage(err) }
      }
    }

    const exePath = this.locateYgoproExe(gameDir)
    if (!exePath) {
      return { success: false, errorCode: 'game-not-found', error: gameDir }
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
    const config = configService.get()
    const gameDir = config.gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }
    const gameType = config.gameType ?? 'ygopro'
    const responses = duelDirector.getAllTimelineResponses()
    if (responses.length === 0) {
      return {
        success: false,
        errorCode: 'no-actions',
        error: '还没有任何经过引擎的操作记录，无法进行录像导出'
      }
    }

    const turnPlayer = (params.state.turnPlayer ?? 0) as 0 | 1
    const duelists = params.state.duelists ?? []
    const names: [string, string] = [
      duelists.find((d) => d.team === turnPlayer)?.name || `Player ${turnPlayer + 1}`,
      duelists.find((d) => d.team === ((1 - turnPlayer) as 0 | 1))?.name ||
        `Player ${2 - turnPlayer}`
    ]
    const name = sanitizeProjectFileName(params.state.title || '未命名对局')

    if (gameType === 'mdpro3') {
      const exePath = join(gameDir, 'MDPro3.exe')
      if (!existsSync(exePath)) {
        return { success: false, errorCode: 'game-not-found', error: gameDir }
      }
      try {
        const { messages } = duelDirector.recordMessageStream()
        completeCardDetails(params.state)
        const safeName = name.replace(/\s+/g, '_')

        const yrpBytes = buildYrpSingleFile({
          names,
          startLp: Number(params.state.players[0]?.lp ?? 8000),
          startHand: Number(params.state.players[0]?.startHand ?? 0),
          drawCount: Number(params.state.players[0]?.maxHand ?? 0),
          opt: DUEL_PSEUDO_SHUFFLE,
          scriptFile: `./single/${safeName}.lua`,
          responses
        })
        const embeddedYrp = new YGOProYrp().fromYrp(yrpBytes)

        const yrp3d = new YGOProYrp3d()
        yrp3d.name0 = names[0]
        yrp3d.name1 = names[1]
        yrp3d.masterRule = Number(params.state.masterRule)
        for (const payload of messages) {
          const message = YGOProMessages.getInstanceFromPayload(payload)
          if (message) yrp3d.messages.push(message)
        }
        const stocReplay = new YGOProStocReplay()
        stocReplay.replay = embeddedYrp
        yrp3d.messages.push(stocReplay)

        const replayDir = join(gameDir, 'replay')
        mkdirSync(replayDir, { recursive: true })
        const yrp3dPath = join(replayDir, `${safeName}.yrp3d`)
        writeFileSync(yrp3dPath, Buffer.from(yrp3d.toYrp3d()))

        let launched = false
        if (params.launch !== false) {
          const child = spawn(exePath, ['-r', safeName], {
            cwd: gameDir,
            detached: true,
            stdio: 'ignore'
          })
          child.unref()
          launched = true
        }
        return { success: true, yrp3dPath, launched }
      } catch (err) {
        return {
          success: false,
          errorCode: 'replay-failed',
          error: toErrorMessage(err)
        }
      }
    }

    const exePath = this.locateYgoproExe(gameDir)
    if (!exePath) {
      return { success: false, errorCode: 'game-not-found', error: gameDir }
    }
    try {
      completeCardDetails(params.state)
      const luaContent = generateLuaScript(params.state, { forReplay: true })

      const singleDir = join(gameDir, 'single')
      const replayDir = join(gameDir, 'replay')
      mkdirSync(singleDir, { recursive: true })
      mkdirSync(replayDir, { recursive: true })
      const luaPath = join(singleDir, `${name}.lua`)
      const yrpPath = join(replayDir, `${name}.yrp`)
      writeFileSync(luaPath, luaContent, 'utf-8')

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
