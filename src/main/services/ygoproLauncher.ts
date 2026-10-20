import { dialog, BrowserWindow, app } from 'electron'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { YGOProYrp } from 'ygopro-yrp-encode'
import { YGOProYrp3d } from 'ygopro-yrp3d-encode'
import { YGOProMessages, YGOProStocReplay } from 'ygopro-msg-encode'
import {
  DuelPuzzleState,
  DuelTestSettings,
  generateLuaScript,
  EngineExportReplayParams,
  EngineExportReplayResult,
  TestInGameResult
} from '@shared/index'
import { configService } from './configService'
import { duelDirector } from './duel/duel-director'
import { checkGameContentCoverage, collectStateCardIds, isGameProgramName } from './gameContent'
import { buildYrpSingleFile, DUEL_PSEUDO_SHUFFLE } from './yrpWriter'
import { sanitizeFileName, sanitizeProjectFileName } from '../utils/fileName'
import { toErrorMessage } from '../utils/errors'
import { completeCardDetails } from './completeCardDetails'

export class YgoproLauncher {
  public async selectGameDirectory(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择 YGO 游戏主目录 (选择后自动识别游戏类型，并读取其中的卡库与本地卡图)',
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

  public async selectExtraPack(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择内容包文件夹 (自动读取其中的卡库 .cdb，并跟随其卡图与脚本)',
      properties: ['openDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  public async selectCardImageDirectory(window?: BrowserWindow): Promise<string | null> {
    const res = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
      title: '选择卡图目录 (YGOPro 的 pics 文件夹，或包含 pics / Picture\\Art 的游戏目录)',
      properties: ['openDirectory']
    })

    if (res.canceled || res.filePaths.length === 0) {
      return null
    }

    return res.filePaths[0]
  }

  private locateYgoproExe(gameDir: string): string | null {
    const candidates = [join(gameDir, 'ygopro.exe'), join(gameDir, 'ygopro')]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    try {
      for (const file of readdirSync(gameDir)) {
        if (isGameProgramName(file)) {
          return join(gameDir, file)
        }
      }
    } catch {
      return null
    }
    return null
  }

  private isEdoproExe(exePath: string): boolean {
    return /edopro/i.test(basename(exePath))
  }

  private async checkCoverageOrDeferred(
    gameDir: string,
    gameType: 'ygopro' | 'mdpro3',
    state: DuelPuzzleState,
    force: boolean
  ): Promise<{
    blocked: boolean
    coverage?: Awaited<ReturnType<typeof checkGameContentCoverage>>
  }> {
    if (force) return { blocked: false }
    const coverage = await checkGameContentCoverage(gameDir, gameType, collectStateCardIds(state))
    if (coverage.missingDataIds.length === 0 && coverage.missingScriptIds.length === 0) {
      return { blocked: false }
    }
    return { blocked: true, coverage }
  }

  public async testInGame(
    state: DuelPuzzleState,
    force = false,
    test?: DuelTestSettings
  ): Promise<TestInGameResult> {
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
      const coverage = await this.checkCoverageOrDeferred(gameDir, gameType, state, force)
      if (coverage.blocked) {
        return { success: false, errorCode: 'content-missing', coverage: coverage.coverage }
      }
      try {
        completeCardDetails(state)
        const luaContent = generateLuaScript(state, { test })

        const puzzleDir = join(gameDir, 'Puzzle')
        const testDir = join(puzzleDir, 'yde-test')
        rmSync(testDir, { recursive: true, force: true })
        mkdirSync(testDir, { recursive: true })
        const name =
          (sanitizeFileName(state.title).trim() || 'puzzle').replace(/\s+/g, '_') || 'puzzle'
        const scriptPath = join(testDir, `${name}.lua`)
        writeFileSync(scriptPath, luaContent, 'utf-8')

        const child = spawn(exePath, ['-s', `yde-test/${name}`], {
          cwd: gameDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()

        console.log(`[FileService] Launched ${exePath} -s yde-test/${name}`)
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

    const coverage = await this.checkCoverageOrDeferred(gameDir, gameType, state, force)
    if (coverage.blocked) {
      return { success: false, errorCode: 'content-missing', coverage: coverage.coverage }
    }

    try {
      completeCardDetails(state)
      const luaContent = generateLuaScript(state, { test })

      const isEdopro = this.isEdoproExe(exePath)
      const name = sanitizeFileName(state.title).trim() || 'puzzle'
      let scriptPath: string
      let args: string[] = []
      if (isEdopro) {
        const puzzleDir = join(gameDir, 'puzzles', 'yde-test')
        rmSync(puzzleDir, { recursive: true, force: true })
        mkdirSync(puzzleDir, { recursive: true })
        scriptPath = join(puzzleDir, `${name}.lua`)
      } else {
        const dir = join(app.getPath('userData'), 'ygo-test')
        mkdirSync(dir, { recursive: true })
        scriptPath = join(dir, `${name}.lua`)
        args = ['-s', scriptPath]
      }
      writeFileSync(scriptPath, luaContent, 'utf-8')

      const child = spawn(exePath, args, {
        cwd: gameDir,
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      console.log(`[FileService] Launched ${exePath} ${args.join(' ')}`)
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

    const coverage = await this.checkCoverageOrDeferred(
      gameDir,
      gameType,
      params.state,
      params.force ?? false
    )
    if (coverage.blocked) {
      return { success: false, errorCode: 'content-missing', coverage: coverage.coverage }
    }

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

      const isEdopro = this.isEdoproExe(exePath)
      let launched = false
      if (params.launch !== false) {
        const child = spawn(exePath, isEdopro ? [] : ['-r', yrpPath], {
          cwd: gameDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        launched = true
      }
      return {
        success: true,
        luaPath,
        yrpPath,
        launched,
        manualHint: isEdopro
          ? `EDOPro 内核不支持通过命令行直接打开回放，录像已保存到游戏目录 replay 下，请在游戏的「观看回放」菜单中选择「${name}」。`
          : undefined
      }
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
