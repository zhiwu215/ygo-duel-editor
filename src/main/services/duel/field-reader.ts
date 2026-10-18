import { OcgcoreDuel } from 'koishipro-core.js'
import type { CardQuery } from 'ygopro-msg-encode'
import { EngineBoardState, EngineCard, EnginePlayerState, CardLocation, CardPosition } from '@shared/index'
import { cdbService } from '../../db/cdbService'

const PHASE_NAMES: Record<number, string> = {
  1: '抽卡阶段 (DP)',
  2: '准备阶段 (SP)',
  4: '主要阶段1 (M1)',
  8: '战斗开始 (BP Start)',
  16: '战斗步骤 (Battle Step)',
  32: '伤害计算 (Damage Calc)',
  64: '伤害步骤 (Damage Step)',
  128: '战斗结束 (BP End)',
  256: '主要阶段2 (M2)',
  512: '结束阶段 (EP)'
}

const MZONE_SIZE = 7
const SZONE_SIZE = 6
const PZONE_SIZE = 2

/** 全量查询 flag（引擎客户端通用"查全部"掩码） */
const QUERY_FLAG_ALL = 0xefffff

const QUERY_ZONES = [
  CardLocation.HAND,
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.GRAVE,
  CardLocation.REMOVED,
  CardLocation.DECK,
  CardLocation.EXTRA,
  CardLocation.FZONE,
  CardLocation.PZONE
] as number[]

/**
 * 全量查询式场地读取器（R1 重构）。
 *
 * 不再听消息记账（旧 BoardTracker），每次直接向引擎查询全部区域的真实状态，
 * 引擎是唯一真相。instanceId 通过"位置精确匹配 + 同 code 移动匹配"保持跨查询连续。
 */
export class FieldReader {
  private idCounter = 0
  /** 上一轮 每张卡的 key → 身份（用于 instanceId 连续性） */
  private identity = new Map<string, { code: number; instanceId: string }>()
  private lastState: EngineBoardState | null = null
  private maxLp: [number, number] = [8000, 8000]
  private meta = { turn: 1, turnPlayer: 0 as 0 | 1, phase: 1 }

  reset(maxLps: [number, number], turnPlayer: 0 | 1 = 0): void {
    this.idCounter = 0
    this.identity.clear()
    this.lastState = null
    this.maxLp = maxLps
    this.meta = { turn: 0, turnPlayer, phase: 1 }
  }

  get currentMeta(): { turn: number; turnPlayer: 0 | 1; phase: number } {
    return { ...this.meta }
  }

  /** 从引擎消息流中追踪回合/阶段（这两个标量不参与场地查询，消息驱动即可） */
  applyMetaMessage(msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return
    const m = msg as { constructor?: { name?: string }; player?: unknown; phase?: unknown }
    const name = m.constructor?.name
    if (name === 'YGOProMsgNewTurn' && typeof m.player === 'number') {
      this.meta.turn += 1
      this.meta.turnPlayer = m.player === 1 ? 1 : 0
    } else if (name === 'YGOProMsgNewPhase' && typeof m.phase === 'number') {
      this.meta.phase = m.phase
    }
  }

  /** 在最近一次快照中查找卡（供 request-router 解析 instanceId） */
  findCard(
    controller: number,
    location: number,
    sequence: number,
    code?: number
  ): { instanceId: string; card?: EngineCard } | undefined {
    const state = this.lastState
    if (!state) return undefined
    const found = state.allCards.find(
      (c) =>
        c.controller === controller &&
        c.location === location &&
        c.sequence === sequence &&
        (code === undefined || c.code === code)
    )
    if (!found && code !== undefined) {
      // 兜底：位置对不上时按 code 找（引擎消息里的 sequence 可能滞后一帧）
      const byCode = state.allCards.find((c) => c.code === code)
      if (byCode) return { instanceId: byCode.instanceId, card: byCode }
      return undefined
    }
    return found ? { instanceId: found.instanceId, card: found } : undefined
  }

  getState(): EngineBoardState {
    if (!this.lastState) throw new Error('FieldReader 尚未读取过场地状态。')
    return this.lastState
  }

  /** 全量查询引擎，生成新的场地快照 */
  readBoard(duel: OcgcoreDuel): EngineBoardState {
    let fieldInfo: ReturnType<OcgcoreDuel['queryFieldInfo']> | null = null
    try {
      fieldInfo = duel.queryFieldInfo()
    } catch (err) {
      console.warn('[field-reader] queryFieldInfo failed:', err)
    }

    // 1) 查询所有区域
    const queried = new Map<
      number,
      { location: number; cards: CardQuery[] }[]
    >()
    for (const player of [0, 1] as const) {
      const zones: { location: number; cards: CardQuery[] }[] = []
      for (const location of QUERY_ZONES) {
        zones.push({ location, cards: this.queryZone(duel, player, location) })
      }
      queried.set(player, zones)
    }

    // 2) 转换为 EngineCard 并维持 instanceId 连续
    const nextIdentity = new Map<string, { code: number; instanceId: string }>()
    const claimedPrev = new Set<string>()
    const allCards: EngineCard[] = []

    interface RawCard {
      card: EngineCard
      key: string
      exactMatched: boolean
    }
    const raws: RawCard[] = []

    for (const [player, zones] of queried) {
      for (const { location, cards } of zones) {
        for (const q of cards) {
          const controller = (q.controller ?? player) === 1 ? 1 : 0
          const sequence = q.sequence ?? 0
          const code = q.code ?? 0
          if (code <= 0) continue
          const key = `${controller}:${location}:${sequence}`
          // 牌堆区（卡组/额外/墓地/除外）没有"表示形式"概念，
          // 强制中性里侧值，避免前端误判守备表示而横置
          const isPile =
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.GRAVE ||
            location === CardLocation.REMOVED
          // 引擎“展示”（POS_REVEAL）经 CardQuery 解出为 q.reveal；
          // 手牌被展示时映射为 FACEUP，供前端渲染“公开”角标（其余区域不受影响）
          const position = isPile
            ? CardPosition.FACEDOWN
            : location === CardLocation.HAND && q.reveal
              ? CardPosition.FACEUP
              : (q.position ?? 0)
          raws.push({
            card: {
              instanceId: '',
              code,
              card: cdbService.getCardById(code) ?? undefined,
              controller: controller as 0 | 1,
              owner: ((q.owner ?? controller) === 1 ? 1 : 0) as 0 | 1,
              location,
              sequence,
              position,
              overlayMaterials: [...(q.overlayCards ?? [])],
              counters: this.toCounters(q)
            },
            key,
            exactMatched: false
          })
        }
      }
    }

    // 2a) 位置精确匹配
    for (const raw of raws) {
      const prev = this.identity.get(raw.key)
      if (prev && prev.code === raw.card.code && !claimedPrev.has(prev.instanceId)) {
        raw.card.instanceId = prev.instanceId
        claimedPrev.add(prev.instanceId)
        raw.exactMatched = true
      }
    }
    // 2b) 同 code 移动匹配（优先同区域，其次任意）
    const unmatchedPrev = [...this.identity.entries()].filter(
      ([, v]) => !claimedPrev.has(v.instanceId)
    )
    for (const raw of raws) {
      if (raw.card.instanceId) continue
      const pickIndex = (preferSameLocation: boolean): number =>
        unmatchedPrev.findIndex(
          ([key, v]) =>
            v.code === raw.card.code &&
            !claimedPrev.has(v.instanceId) &&
            (!preferSameLocation || key.split(':')[1] === String(raw.card.location))
        )
      const pick = pickIndex(true) !== -1 ? pickIndex(true) : pickIndex(false)
      if (pick !== -1) {
        const [, prev] = unmatchedPrev[pick]
        raw.card.instanceId = prev.instanceId
        claimedPrev.add(prev.instanceId)
        unmatchedPrev.splice(pick, 1)
      }
    }
    // 2c) 其余视为新卡
    for (const raw of raws) {
      if (!raw.card.instanceId) {
        raw.card.instanceId = this.allocateId()
      }
      nextIdentity.set(raw.key, { code: raw.card.code, instanceId: raw.card.instanceId })
      allCards.push(raw.card)
    }
    this.identity = nextIdentity

    // 3) 组装玩家状态
    const players = [0, 1].map((player): EnginePlayerState => {
      const fp = fieldInfo?.field?.players?.[player]
      const cards = allCards.filter((c) => c.controller === player)
      const mzone: (EngineCard | null)[] = Array.from({ length: MZONE_SIZE }, () => null)
      const szone: (EngineCard | null)[] = Array.from({ length: SZONE_SIZE }, () => null)
      const pzone: (EngineCard | null)[] = Array.from({ length: PZONE_SIZE }, () => null)
      let fzone: EngineCard | null = null
      for (const card of cards) {
        if (card.location === CardLocation.MZONE && card.sequence < MZONE_SIZE) {
          mzone[card.sequence] = card
        } else if (card.location === CardLocation.SZONE && card.sequence < SZONE_SIZE) {
          szone[card.sequence] = card
        } else if (card.location === CardLocation.FZONE) {
          fzone = card
        } else if (card.location === CardLocation.PZONE && card.sequence < PZONE_SIZE) {
          pzone[card.sequence] = card
        }
      }
      return {
        player: player as 0 | 1,
        lp: Number(fp?.lp ?? 0),
        maxLp: this.maxLp[player],
        deckCount: Number(fp?.deckCount ?? cards.filter((c) => c.location === CardLocation.DECK).length),
        extraCount: Number(fp?.extraCount ?? cards.filter((c) => c.location === CardLocation.EXTRA).length),
        graveCount: Number(fp?.graveCount ?? cards.filter((c) => c.location === CardLocation.GRAVE).length),
        removedCount: Number(fp?.removedCount ?? cards.filter((c) => c.location === CardLocation.REMOVED).length),
        hand: cards.filter((c) => c.location === CardLocation.HAND),
        deck: cards.filter((c) => c.location === CardLocation.DECK),
        extra: cards.filter((c) => c.location === CardLocation.EXTRA),
        mzone,
        szone,
        fzone,
        pzone,
        graveyard: cards.filter((c) => c.location === CardLocation.GRAVE),
        banished: cards.filter((c) => c.location === CardLocation.REMOVED)
      }
    }) as [EnginePlayerState, EnginePlayerState]

    const state: EngineBoardState = {
      turn: this.meta.turn,
      turnPlayer: this.meta.turnPlayer,
      phase: this.meta.phase,
      phaseName: PHASE_NAMES[this.meta.phase] || `阶段 ${this.meta.phase}`,
      players,
      allCards
    }

    this.lastState = state
    return state
  }

  private queryZone(duel: OcgcoreDuel, player: number, location: number): CardQuery[] {
    try {
      const res = duel.queryFieldCard({
        player,
        location,
        queryFlag: QUERY_FLAG_ALL,
        useCache: 0
      })
      return res?.cards ?? []
    } catch (err) {
      console.warn(`[field-reader] queryFieldCard(player=${player}, location=${location}) failed:`, err)
      return []
    }
  }

  private toCounters(q: CardQuery): Record<number, number> | undefined {
    if (!q.counters || q.counters.length === 0) return undefined
    const counters: Record<number, number> = {}
    for (const c of q.counters) counters[c.type] = c.count
    return counters
  }

  private allocateId(): string {
    this.idCounter += 1
    return `card-${this.idCounter}`
  }
}
