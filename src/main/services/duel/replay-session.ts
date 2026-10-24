import { YGOProYrp, REPLAY_UNIFORM } from 'ygopro-yrp-encode'
import { YGOProYrp3d } from 'ygopro-yrp3d-encode'
import { createDuelFromYrp } from 'koishipro-core.js'
import { existsSync } from 'fs'
import { join } from 'path'
import { createStandardTagDuelists, getStandardTagSeat } from '@shared/index'
import type { EngineBoardState, EngineReplaySummary, EngineTimelineNode } from '@shared/index'
import type { FieldReaderTagSeat } from './field-reader'
import { configService } from '../configService'
import { advanceEngine } from './engine-pump'
import { headPendingQuery, type SessionState } from './session-state'

export interface ReplayPlayback {
  bytes: Uint8Array
  fileName: string
}

export interface EngineReplayStartPayload {
  info: EngineReplaySummary
  boardState: EngineBoardState
  timeline: EngineTimelineNode[]
  currentStepId: string
}

function assertReplaySupported(yrp: YGOProYrp, fileName: string): void {
  const header = yrp.header
  if (!header) {
    throw new Error(`无法解析 YRP 录像（${fileName}）：缺少有效头部。`)
  }
  if (!(header.flag & REPLAY_UNIFORM)) {
    throw new Error(`暂不支持旧版随机数（非 UNIFORM）的回放（${fileName}）。`)
  }
  if (yrp.responses.length === 0) {
    throw new Error(`该回放没有任何操作记录（${fileName}）。`)
  }
}

function buildTagSeats(yrp: YGOProYrp): FieldReaderTagSeat[] | undefined {
  if (!yrp.isTag) return undefined
  const names = new Map<string, string>([
    ['duelist_0_0', yrp.hostName],
    ['duelist_1_0', yrp.clientName],
    ['duelist_0_1', yrp.tagHostName ?? ''],
    ['duelist_1_1', yrp.tagClientName ?? '']
  ])
  const seats: FieldReaderTagSeat[] = []
  for (const duelist of createStandardTagDuelists()) {
    const seat = getStandardTagSeat(duelist.id)
    if (seat === undefined) continue
    seats.push({
      id: duelist.id,
      team: duelist.team,
      seat,
      name: names.get(duelist.id) || duelist.name
    })
  }
  return seats
}

function assertSingleScriptAvailable(yrp: YGOProYrp, fileName: string): void {
  if (!yrp.isSingleMode || !yrp.singleScript) return
  const gameDir = configService.get().gameDirectory
  if (!gameDir) {
    throw new Error(
      '残局回放需要先在 设置 → 路径 中选择 ygopro 游戏目录（用于读取残局脚本与卡片脚本）。'
    )
  }
  const scriptPath = join(gameDir, 'single', yrp.singleScript)
  if (!existsSync(scriptPath)) {
    throw new Error(
      `未找到回放对应的残局脚本 single/${yrp.singleScript}（来自 ${fileName}）。\n请在游戏目录的 single 文件夹中保留该脚本后重试。`
    )
  }
}

export interface ParsedYrpReplay {
  yrp: YGOProYrp
  bytes: Uint8Array
}

function isYrpMagic(bytes: Uint8Array): boolean {
  const magic = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)
  return magic === 'yrp1' || magic === 'yrp2'
}

function unwrapYrp(bytes: Uint8Array, fileName: string): YGOProYrp {
  if (isYrpMagic(bytes)) {
    return new YGOProYrp().fromYrp(bytes)
  }
  const embedded = new YGOProYrp3d().fromYrp3d(bytes).extractYrp()
  if (!embedded) {
    throw new Error(`.yrp3d 回放包中没有内嵌标准 YRP 录像（${fileName}）。`)
  }
  return embedded
}

export function parseYrpReplay(bytes: Uint8Array, fileName: string): ParsedYrpReplay {
  let yrp: YGOProYrp
  try {
    yrp = unwrapYrp(bytes, fileName)
  } catch (err) {
    throw new Error(
      `无法解析回放文件（${fileName}）：${err instanceof Error ? err.message : String(err)}`
    )
  }
  assertReplaySupported(yrp, fileName)
  assertSingleScriptAvailable(yrp, fileName)
  return { yrp, bytes: isYrpMagic(bytes) ? bytes : yrp.toYrp() }
}

export function setupReplayDuel(
  state: SessionState,
  yrp: YGOProYrp,
  bytes: Uint8Array,
  fileName: string
): void {
  const { duel } = createDuelFromYrp(state.ocgcore!, bytes)
  const startLp = yrp.startLp > 0 ? yrp.startLp : 8000
  const tagSeats = buildTagSeats(yrp)
  state.fieldReader.reset([startLp, startLp], 0, tagSeats ? { duelists: tagSeats } : undefined)
  state.duel = duel
  state.seed = [...(yrp.header?.seedSequence ?? [])]
  state.replay = { bytes, fileName }
}

export function buildReplayTimeline(state: SessionState, yrp: YGOProYrp): string | undefined {
  state.replaying = true
  try {
    advanceEngine(state)
    const initialBoard = state.fieldReader.readBoard(state.duel!)
    const initialNode = state.timeline.addStep(
      '回放开局',
      initialBoard.turnPlayer,
      initialBoard,
      null,
      [...state.accumulatedLogs],
      [...state.accumulatedEvents],
      [...state.accumulatedLogEvents],
      -1
    )
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []

    let warning: string | undefined
    let previousNode: EngineTimelineNode | null = null
    const frames = yrp.responses.filter((frame) => frame.length > 0)
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      const head = headPendingQuery(state)
      if (!head) {
        warning = `回放共 ${frames.length} 步，引擎在第 ${i} 步后已结束，仅回放前 ${i} 步。`
        break
      }
      if (previousNode && head.request.kind === 'chain') {
        previousNode.pendingRequest = head.request
      }
      const askTitle = head.request.title || `回放步骤 ${i + 1}`
      const actingPlayer = head.request.player
      state.duel!.setResponse(frame)
      advanceEngine(state)
      if (state.lastAdvanceRetried) {
        const frameHex = [...frame].map((v) => v.toString(16).padStart(2, '0')).join(' ')
        warning = `回放第 ${i + 1}/${frames.length} 步被引擎拒绝：引擎正在等待"${askTitle}"（玩家 ${actingPlayer}）的响应，收到的帧 [${frameHex}] 与其不匹配，仅回放前 ${i} 步。录像可能由不同版本的引擎或卡脚本生成。`
        break
      }
      const after = state.fieldReader.readBoard(state.duel!)
      state.ops.push({ type: 'answer', nodeId: '', responses: [frame] })
      const node = state.timeline.addStep(
        askTitle,
        actingPlayer,
        after,
        null,
        [...state.accumulatedLogs],
        [...state.accumulatedEvents],
        [...state.accumulatedLogEvents],
        state.ops.length - 1
      )
      previousNode = node
      const op = state.ops[state.ops.length - 1]
      if (op.type === 'answer') op.nodeId = node.id
      state.requestSeq += 1
      state.accumulatedLogs = []
      state.accumulatedEvents = []
      state.accumulatedLogEvents = []
    }
    if (state.lastParseError) {
      const parseWarning = `引擎产生了无法完整解析的消息（${state.lastParseError}）`
      warning = warning ? `${warning}；${parseWarning}` : parseWarning
    }
    if (state.lastScriptError) {
      const scriptWarning = `回放过程中脚本执行失败：${state.lastScriptError.slice(0, 240)}`
      warning = warning ? `${warning}；${scriptWarning}` : scriptWarning
    }
    state.timeline.setCurrentStepId(initialNode.id)
    return warning
  } finally {
    state.replaying = false
    state.accumulatedLogs = []
    state.accumulatedEvents = []
    state.accumulatedLogEvents = []
  }
}
