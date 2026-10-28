import { dialog, BrowserWindow, app } from 'electron'
import { spawn } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync
} from 'fs'
import { basename, join } from 'path'
import { YGOProYrp } from 'ygopro-yrp-encode'
import { YGOProYrp3d } from 'ygopro-yrp3d-encode'
import { YGOProStocReplay } from 'ygopro-msg-encode'
import {
  DuelPuzzleState,
  DuelTestSettings,
  generateLuaScript,
  EngineExportReplayParams,
  EngineExportReplayResult,
  EngineOpenReplayResult,
  ReplayDeleteResult,
  ReplayFileEntry,
  ReplayFileListResult,
  TestInGameResult,
  isPlaceholderCard,
  isStandardTag
} from '@shared/index'
import { configService } from './configService'
import { duelDirector } from './duel/duel-director'
import { checkGameContentCoverage, collectStateCardIds, isGameProgramName } from './gameContent'
import { buildDuelFlag, buildYrpSingleFile, buildYrpTagFile } from './yrpWriter'
import { buildTagReplayData, type TagReplayData } from './duel/tagReplayDecks'
import { buildYrp3dMessages } from './yrp3dMessages'
import { sanitizeFileName, sanitizeProjectFileName } from '../utils/fileName'
import { toErrorMessage } from '../utils/errors'
import { completeCardDetails } from './completeCardDetails'
import { mapPlaceholderCodesForGame } from './placeholderGameCards'
import { syncCustomCardsToGame } from './customGameSync'

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

  private buildReplayNames(state: DuelPuzzleState, tag: boolean): string[] {
    const duelists = state.duelists ?? []
    const nameOf = (team: 0 | 1, member: number, fallback: string): string =>
      duelists.filter((duelist) => duelist.team === team)[member]?.name ||
      duelists.find((duelist) => duelist.id === `duelist_${team}_${member}`)?.name ||
      fallback

    if (tag) {
      return [
        nameOf(0, 0, '我方 1'),
        nameOf(0, 1, '我方 2'),
        nameOf(1, 1, '对方 2'),
        nameOf(1, 0, '对方 1')
      ]
    }

    return [nameOf(0, 0, 'Player 1'), nameOf(1, 0, 'Player 2')]
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
    const gameState = mapPlaceholderCodesForGame(state)
    if (collectStateCardIds(gameState).some(isPlaceholderCard)) {
      await syncCustomCardsToGame()
    }

    if (gameType === 'mdpro3') {
      const exePath = join(gameDir, 'MDPro3.exe')
      if (!existsSync(exePath)) {
        return { success: false, errorCode: 'game-not-found', error: gameDir }
      }
      const coverage = await this.checkCoverageOrDeferred(gameDir, gameType, gameState, force)
      if (coverage.blocked) {
        return { success: false, errorCode: 'content-missing', coverage: coverage.coverage }
      }
      try {
        completeCardDetails(gameState)
        const luaContent = generateLuaScript(gameState, { test })

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

    const coverage = await this.checkCoverageOrDeferred(gameDir, gameType, gameState, force)
    if (coverage.blocked) {
      return { success: false, errorCode: 'content-missing', coverage: coverage.coverage }
    }

    try {
      completeCardDetails(gameState)
      const luaContent = generateLuaScript(gameState, { test })

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

  public listReplays(): ReplayFileListResult {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return { success: false, entries: [], error: '未配置游戏目录' }
    }
    const replayDir = join(gameDir, 'replay')
    if (!existsSync(replayDir)) return { success: true, entries: [] }
    try {
      const entries = readdirSync(replayDir)
        .filter((fileName) => /\.(yrp|yrp3d)$/i.test(fileName))
        .map((fileName): ReplayFileEntry => {
          const stat = statSync(join(replayDir, fileName))
          const baseName = fileName.replace(/\.(yrp|yrp3d)$/i, '')
          return {
            fileName,
            baseName,
            size: stat.size,
            modifiedAt: stat.mtimeMs,
            hasLua: existsSync(join(gameDir, 'single', `${baseName}.lua`))
          }
        })
        .filter((entry) => entry.hasLua)
        .sort((left, right) => right.modifiedAt - left.modifiedAt)
      return { success: true, entries }
    } catch (err) {
      console.error('[YgoproLauncher] listReplays failed:', err)
      return { success: false, entries: [], error: toErrorMessage(err) }
    }
  }

  public deleteReplays(fileNames: string[]): ReplayDeleteResult {
    const gameDir = configService.get().gameDirectory
    if (!gameDir) {
      return {
        success: false,
        deletedReplays: 0,
        deletedScripts: 0,
        error: '未配置游戏目录'
      }
    }
    const replayDir = join(gameDir, 'replay')
    const singleDir = join(gameDir, 'single')
    const selected = new Set(
      fileNames
        .map((fileName) => basename(fileName))
        .filter((fileName) => /\.(yrp|yrp3d)$/i.test(fileName))
    )
    let deletedReplays = 0
    let deletedScripts = 0
    try {
      for (const fileName of readdirSync(replayDir)) {
        if (!selected.has(fileName)) continue
        const baseName = fileName.replace(/\.(yrp|yrp3d)$/i, '')
        rmSync(join(replayDir, fileName), { force: true })
        deletedReplays++
        const luaPath = join(singleDir, `${baseName}.lua`)
        if (existsSync(luaPath)) {
          rmSync(luaPath, { force: true })
          deletedScripts++
        }
      }
      return { success: true, deletedReplays, deletedScripts }
    } catch (err) {
      console.error('[YgoproLauncher] deleteReplays failed:', err)
      return {
        success: false,
        deletedReplays,
        deletedScripts,
        error: toErrorMessage(err)
      }
    }
  }

  public async openReplay(filePath: string): Promise<EngineOpenReplayResult> {
    const config = configService.get()
    const gameDir = config.gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }
    if (!filePath || !existsSync(filePath)) {
      return { success: false, errorCode: 'replay-missing', error: filePath }
    }
    const gameType = config.gameType ?? this.detectGameType(gameDir) ?? 'ygopro'
    if (gameType !== 'mdpro3' && /\.yrp3d$/i.test(filePath)) {
      return {
        success: false,
        errorCode: 'replay-failed',
        error: '当前游戏目录是 ygopro，无法直接打开 .yrp3d 回放；请将游戏目录切换为 MDPro3。'
      }
    }
    try {
      const replayDir = join(gameDir, 'replay')
      mkdirSync(replayDir, { recursive: true })
      const replayPath = join(replayDir, basename(filePath))
      if (replayPath !== filePath) copyFileSync(filePath, replayPath)

      if (gameType === 'mdpro3') {
        const exePath = join(gameDir, 'MDPro3.exe')
        if (!existsSync(exePath)) {
          return { success: false, errorCode: 'game-not-found', error: gameDir }
        }
        const name = basename(replayPath).replace(/\.(?:yrp3d|yrp)$/i, '')
        const child = spawn(exePath, ['-r', name], {
          cwd: gameDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        return { success: true, replayPath, launched: true }
      }

      const exePath = this.locateYgoproExe(gameDir)
      if (!exePath) {
        return { success: false, errorCode: 'game-not-found', error: gameDir }
      }
      if (this.isEdoproExe(exePath)) {
        return {
          success: true,
          replayPath,
          launched: false,
          manualHint: `EDOPro 内核不支持通过命令行直接打开回放，录像已保存到 replay 目录，请在游戏的「观看回放」菜单中选择「${basename(replayPath)}」。`
        }
      }
      const child = spawn(exePath, ['-r', replayPath], {
        cwd: gameDir,
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      return { success: true, replayPath, launched: true }
    } catch (err) {
      return { success: false, errorCode: 'replay-failed', error: toErrorMessage(err) }
    }
  }

  public async exportReplay(params: EngineExportReplayParams): Promise<EngineExportReplayResult> {
    const config = configService.get()
    const gameDir = config.gameDirectory
    if (!gameDir) {
      return { success: false, errorCode: 'no-game-directory' }
    }
    const gameType = config.gameType ?? 'ygopro'
    const isTag = isStandardTag(params.state.matchConfig)
    if (duelDirector.hasInjectOps()) {
      return {
        success: false,
        errorCode: 'replay-failed',
        error:
          '当前引擎会话包含注入操作（加卡、替换等）\n\n如果这些卡原本就应在开局盘面/卡组里，请先摆好再启动引擎。\n中途注入只能改用「使用游戏测试该局」测试当前盘面。\n或从无注入的开局重新对局后导出回放。'
      }
    }
    const responses = await duelDirector.exportReplayResponses()
    const seed = duelDirector.getSeed()
    if (responses.length === 0) {
      return {
        success: false,
        errorCode: 'no-actions',
        error: '还没有任何经过引擎的操作记录，无法进行录像导出'
      }
    }
    const startBoard = duelDirector.getTimeline()[0]?.boardState
    if (startBoard && (startBoard.turn !== 1 || startBoard.turnPlayer !== 0)) {
      return {
        success: false,
        errorCode: 'replay-start',
        error: `当前引擎会话从第 ${startBoard.turn} 回合、${
          startBoard.turnPlayer === 0 ? '我方' : '对方'
        }行动开始；YRP 回放固定从第 1 回合玩家 0 开始，无法从中间盘面重演。请回到第 1 回合我方先攻的开局重新启动引擎后再导出。`
      }
    }

    const names = this.buildReplayNames(params.state, isTag)
    const initParams = duelDirector.getInitParams()
    const rawReplayState = initParams?.puzzleState ?? params.state
    const replayState =
      gameType === 'mdpro3' ? rawReplayState : mapPlaceholderCodesForGame(rawReplayState)
    if (collectStateCardIds(replayState).some(isPlaceholderCard)) {
      await syncCustomCardsToGame()
    }
    let tagReplay: TagReplayData | null = null
    let tagYrpBytes: Uint8Array | null = null
    if (isTag) {
      try {
        tagReplay = buildTagReplayData(replayState)
        tagYrpBytes = buildYrpTagFile({
          names,
          seed,
          startLp: tagReplay.startLp,
          startHand: tagReplay.startHand,
          drawCount: tagReplay.drawCount,
          opt: buildDuelFlag(Number(replayState.masterRule), replayState.firstTurnAttack, true),
          decks: tagReplay.decks,
          responses
        })
      } catch (err) {
        return { success: false, errorCode: 'replay-failed', error: toErrorMessage(err) }
      }
    }
    const name = sanitizeProjectFileName(params.name?.trim() || params.state.title || '未命名对局')
    const safeName = name.replace(/\s+/g, '_')
    const conflictPaths =
      gameType === 'mdpro3'
        ? [
            join(gameDir, 'replay', `${safeName}.yrp3d`),
            ...(tagReplay ? [] : [join(gameDir, 'single', `${safeName}.lua`)])
          ]
        : [
            join(gameDir, 'replay', `${name}.yrp`),
            ...(tagReplay ? [] : [join(gameDir, 'single', `${name}.lua`)])
          ]
    const existingPath = conflictPaths.find((path) => existsSync(path))
    if (existingPath && !params.overwrite) {
      return { success: false, errorCode: 'replay-exists', existingPath, name }
    }

    const coverage = await this.checkCoverageOrDeferred(
      gameDir,
      gameType,
      replayState,
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
        const { messages } = await duelDirector.recordMessageStream()
        if (!tagReplay) completeCardDetails(replayState)
        const luaContent = tagReplay ? null : generateLuaScript(replayState, { forReplay: true })

        const yrpBytes =
          tagYrpBytes ??
          buildYrpSingleFile({
            names: [names[0] ?? '', names[1] ?? ''],
            seed,
            startLp: Number(replayState.players[0]?.lp ?? 8000),
            startHand: Number(replayState.players[0]?.startHand ?? 0),
            drawCount: 1,
            opt: buildDuelFlag(
              Number(params.state.masterRule),
              params.state.firstTurnAttack,
              false
            ),
            scriptFile: `./single/${safeName}.lua`,
            responses
          })
        const embeddedYrp = new YGOProYrp().fromYrp(yrpBytes)

        const yrp3d = new YGOProYrp3d()
        yrp3d.name0 = names[0]
        yrp3d.name1 = names[isTag ? 3 : 1]
        yrp3d.name0Current = names[0]
        yrp3d.name1Current = names[isTag ? 3 : 1]
        if (isTag) {
          yrp3d.name0Tag = names[1]
          yrp3d.name1Tag = names[2]
        }
        yrp3d.masterRule = Number(params.state.masterRule)
        yrp3d.messages.push(...buildYrp3dMessages(messages))
        const stocReplay = new YGOProStocReplay()
        stocReplay.replay = embeddedYrp
        yrp3d.messages.push(stocReplay)

        const replayDir = join(gameDir, 'replay')
        const singleDir = join(gameDir, 'single')
        mkdirSync(replayDir, { recursive: true })
        if (luaContent) mkdirSync(singleDir, { recursive: true })
        const yrp3dPath = join(replayDir, `${safeName}.yrp3d`)
        const luaPath = join(singleDir, `${safeName}.lua`)
        if (luaContent) writeFileSync(luaPath, luaContent, 'utf-8')
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
        return {
          success: true,
          yrp3dPath,
          luaPath: luaContent ? luaPath : undefined,
          launched
        }
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
      if (!tagReplay) completeCardDetails(replayState)
      const luaContent = tagReplay ? null : generateLuaScript(replayState, { forReplay: true })

      const singleDir = join(gameDir, 'single')
      const replayDir = join(gameDir, 'replay')
      if (luaContent) mkdirSync(singleDir, { recursive: true })
      mkdirSync(replayDir, { recursive: true })
      const luaPath = join(singleDir, `${name}.lua`)
      const yrpPath = join(replayDir, `${name}.yrp`)
      if (luaContent) writeFileSync(luaPath, luaContent, 'utf-8')

      const yrpBytes =
        tagYrpBytes ??
        buildYrpSingleFile({
          names: [names[0] ?? '', names[1] ?? ''],
          seed,
          startLp: Number(replayState.players[0]?.lp ?? 8000),
          startHand: Number(replayState.players[0]?.startHand ?? 0),
          drawCount: 1,
          opt: buildDuelFlag(Number(params.state.masterRule), params.state.firstTurnAttack, false),
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
        luaPath: luaContent ? luaPath : undefined,
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
