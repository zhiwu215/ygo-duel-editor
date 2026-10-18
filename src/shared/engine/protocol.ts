/**
 * 游戏王决斗编辑器 · 引擎问答协议（R2 重构）。
 *
 * 引擎在每个决策时点停下，发出一个 EngineRequest（纯数据，渲染端可直接消费）；
 * 渲染端回答一个 Answer（语义对象，不是字节）；字节编码在引擎侧完成
 * （answer-encoder → msg.prepareResponse）。
 *
 * 铁律：跨 IPC 只传纯数据，不传 ygopro-msg-encode 类实例（过不了 structuredClone）。
 */
import { EngineBoardState, EngineDiffResult, EngineTimelineNode } from '../types/duelEngine'

export type RequestKind =
  | 'idle'
  | 'battle'
  | 'card'
  | 'tribute'
  | 'chain'
  | 'place'
  | 'disfield'
  | 'position'
  | 'yesno'
  | 'option'
  | 'counter'
  | 'sum'
  | 'sort'
  | 'unselect'
  | 'rps'
  | 'announce'

export type AnnounceType = 'race' | 'attrib' | 'number' | 'card'

/** 请求中携带的卡片引用（引擎消息的纯数据副本） */
export interface RequestCard {
  code: number
  controller: 0 | 1
  location: number
  sequence: number
  /** 发动效果描述码（activatable 卡携带） */
  desc?: number
  /** 战斗阶段：能否直接攻击 */
  directAttackable?: boolean
  /** SelectSum：运算参数 */
  opParam?: number
  /** SelectCounter：该卡可取除的指示物数量 */
  counterCount?: number
}

export interface RequestPlace {
  controller: 0 | 1
  location: number
  sequence: number
}

export type RequestData =
  | {
      kind: 'idle'
      summonable: RequestCard[]
      spSummonable: RequestCard[]
      msetable: RequestCard[]
      ssetable: RequestCard[]
      reposable: RequestCard[]
      activatable: RequestCard[]
      canBp: boolean
      canEp: boolean
      canShuffle: boolean
    }
  | {
      kind: 'battle'
      attackable: RequestCard[]
      activatable: RequestCard[]
      canM2: boolean
      canEp: boolean
    }
  | { kind: 'card'; cards: RequestCard[]; min: number; max: number; cancelable: boolean }
  | { kind: 'tribute'; cards: RequestCard[]; min: number; max: number; cancelable: boolean }
  | { kind: 'chain'; chains: RequestCard[]; forced: boolean }
  | { kind: 'place'; places: RequestPlace[]; count: number }
  | { kind: 'disfield'; places: RequestPlace[]; count: number }
  | { kind: 'position'; positions: number[]; code?: number }
  /** SelectYesNo(13) 与 SelectEffectYn(12) 统一 */
  | { kind: 'yesno'; desc: number; card?: RequestCard }
  | { kind: 'option'; options: { code: number; text?: string }[] }
  | {
      kind: 'counter'
      counterType: number
      /** 引擎要求取除的指示物总数 */
      counterCount: number
      count: number
      cards: RequestCard[]
    }
  | {
      kind: 'sum'
      mode: number
      sumVal: number
      min: number
      max: number
      count: number
      mustSelect: RequestCard[]
      cards: RequestCard[]
    }
  | { kind: 'sort'; cards: RequestCard[] }
  | {
      kind: 'unselect'
      finishable: boolean
      cancelable: boolean
      min: number
      max: number
      selectable: RequestCard[]
      unselectable: RequestCard[]
    }
  | { kind: 'rps' }
  | {
      kind: 'announce'
      announceType: AnnounceType
      count: number
      /** race/attrib 的可用位掩码 */
      availableMask?: number
      /** number 的候选数字 */
      numbers?: number[]
    }

export interface EngineRequest {
  /** 唯一 id（answer 记录用它做时间线节点 id） */
  id: string
  /** 单调递增请求序号 */
  seq: number
  /** 该谁操作 */
  player: 0 | 1
  kind: RequestKind
  /** 原始消息 identifier，调试用 */
  identifier: number
  /** 人类可读标题 */
  title: string
  subtitle?: string
  /** 请求前最近一条 HINT_SELECTMSG 的 desc（如 549=选择攻击对象） */
  descHint?: number
  data: RequestData
}

// ------------------------------------------------------------------ Answer

export type IdleCmd =
  | 'SUMMON'
  | 'SPSUMMON'
  | 'MSET'
  | 'SSET'
  | 'REPOS'
  | 'ACTIVATE'
  | 'TO_BP'
  | 'TO_EP'
  | 'SHUFFLE'

export type BattleCmd = 'ATTACK' | 'ACTIVATE' | 'TO_M2' | 'TO_EP'

export type Answer =
  | { kind: 'idle'; cmd: IdleCmd; card?: RequestCard }
  | { kind: 'battle'; cmd: BattleCmd; card?: RequestCard }
  /** null = 取消（走 defaultResponse） */
  | { kind: 'card'; cards: RequestCard[] | null }
  | { kind: 'tribute'; cards: RequestCard[] | null }
  /** null/缺省 = 不连锁（走 defaultResponse） */
  | { kind: 'chain'; card?: RequestCard | null }
  | { kind: 'place'; places: RequestPlace[] }
  | { kind: 'position'; position: number }
  | { kind: 'yesno'; yes: boolean }
  | { kind: 'option'; index: number }
  | { kind: 'counter'; counters: { card: RequestCard; count: number }[] }
  | { kind: 'sum'; cards: RequestCard[] }
  | { kind: 'sort'; cards: RequestCard[] | null }
  /** null = 结束/取消（走 defaultResponse） */
  | { kind: 'unselect'; card?: RequestCard | null }
  | { kind: 'rps'; hand: 'rock' | 'scissors' | 'paper' }
  /** race/attrib = 位掩码；number = 数字；card = 卡密 */
  | { kind: 'announce'; value: number }

// ------------------------------------------------------------------ 注入（编辑操作，作者权限）

export type InjectCommand =
  | {
      op: 'add-card'
      player: 0 | 1
      code: number
      to:
        | 'hand'
        | 'deck-top'
        | 'deck-bottom'
        | 'deck-shuffle'
        | 'grave-top'
        | 'grave-bottom'
        | 'removed'
        | 'extra'
        | 'mzone'
        | 'szone'
        | 'fzone'
      /** mzone/szone 的格子序号；hand 追加时无需 */
      sequence?: number
      position?: number
    }
  | { op: 'set-lp'; player: 0 | 1; lp: number }

/** submitAnswer 的结果（retry=true 表示引擎拒绝，请求保持待答） */
export interface EngineSubmitAnswerResult {
  retry: boolean
  boardState?: EngineBoardState
  pendingRequest?: EngineRequest | null
  node?: EngineTimelineNode
  diff?: EngineDiffResult
}
