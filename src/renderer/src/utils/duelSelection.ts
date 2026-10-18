/**
 * S3 · 选卡询问统一状态机（neos selection 思路的简化版）。
 *
 * 一个「选择/取消选择」询问（card / tribute / sum / unselect）先在这里被推导成
 * 纯数据视图（DerivedSelection），再由 UI 决定呈现方式：
 *   - point：候选全在场上/手牌 → 直接点卡（CardItem 高亮/提交）+ DuelSelectionBar 底部条
 *   - modal：候选含牌堆/墓地/除外等 → 走 DuelRequestModals 弹窗（unselect 由底部条自带的弹窗兜底）
 *
 * 这里是唯一的「候选 / min-max / 可取消 / 可完成 / 点选还是弹窗」判定来源，
 * 避免 CardItem、底部条、弹窗各自重复一份规则。
 */
import { CardLocation } from '@shared/index'
import type { Answer, EngineRequest, RequestCard } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

export type DuelSelectionKind = 'card' | 'tribute' | 'sum' | 'unselect'
export type DuelSelectionMode = 'point' | 'modal'

/** HINT_SELECTMSG desc：549 = 选择攻击对象（ygopro-core 攻击宣言流程） */
export const ATTACK_TARGET_DESC_HINT = 549

export interface DerivedSelection {
  kind: DuelSelectionKind
  /** 可点选 / 可勾选的候选卡 */
  candidates: RequestCard[]
  /**
   * 已选中的卡：
   * - unselect：引擎随请求累计回传的 unselectable
   * - card / tribute / sum：由调用方会话状态（useSelectionStore）维护，这里恒为空
   */
  selected: RequestCard[]
  min: number
  max: number
  canCancel: boolean
  /** 请求自带 finishable 语义（unselect 逐张模式专用） */
  canFinish: boolean
  mode: DuelSelectionMode
  /**
   * 攻击目标选择（card 询问 + descHint 549）：候选是对方场上怪兽，
   * 点选即确定攻击对象；可取消时取消 = 撤销攻击宣言。
   */
  attackTarget?: boolean
}

/** 允许「直接点卡」的位置：场上与手牌 */
const POINT_LOCATIONS: ReadonlySet<number> = new Set<number>([
  CardLocation.HAND,
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.FZONE
])

/** 所有候选都在场上/手牌才允许点选（空候选交给弹窗/底条自己处理） */
function resolveMode(cards: RequestCard[]): DuelSelectionMode {
  return cards.length > 0 && cards.every((card) => POINT_LOCATIONS.has(card.location))
    ? 'point'
    : 'modal'
}

/** 卡片身份四元组（引擎消息与棋盘卡片唯一的对齐口径） */
export function requestCardKey(card: {
  code: number
  controller: number
  location: number
  sequence: number
}): string {
  return `${card.controller}:${card.location}:${card.sequence}:${card.code}`
}

export function isSameRequestCard(
  a: { code: number; controller: number; location: number; sequence: number },
  b: { code: number; controller: number; location: number; sequence: number }
): boolean {
  return (
    a.code === b.code &&
    a.controller === b.controller &&
    a.location === b.location &&
    a.sequence === b.sequence
  )
}

/**
 * 把当前 EngineRequest 推导成选卡视图；非选卡询问返回 null。
 */
export function deriveSelection(
  request: EngineRequest | null | undefined
): DerivedSelection | null {
  if (!request) return null
  const data = request.data

  if (data.kind === 'card' || data.kind === 'tribute') {
    return {
      kind: data.kind,
      candidates: data.cards,
      selected: [],
      min: Math.max(0, data.min),
      max: data.max > 0 ? data.max : data.cards.length,
      canCancel: data.cancelable,
      canFinish: false,
      mode: resolveMode(data.cards),
      attackTarget: data.kind === 'card' && request.descHint === ATTACK_TARGET_DESC_HINT
    }
  }

  if (data.kind === 'sum') {
    return {
      kind: 'sum',
      candidates: data.cards,
      selected: [],
      min: Math.max(0, data.min),
      // max<=0 表示不限制：以候选池大小为上限
      max: data.max > 0 ? data.max : data.cards.length,
      // SelectSum 协议没有 cancelable 标志
      canCancel: false,
      canFinish: false,
      mode: resolveMode(data.cards)
    }
  }

  if (data.kind === 'unselect') {
    const all = [...data.selectable, ...data.unselectable]
    return {
      kind: 'unselect',
      candidates: data.selectable,
      selected: data.unselectable,
      min: Math.max(0, data.min),
      max: data.max > 0 ? data.max : all.length,
      canCancel: data.cancelable,
      canFinish: data.finishable,
      mode: resolveMode(all)
    }
  }

  return null
}

function submitAnswer(answer: Answer): void {
  void useDuelEngineStore.getState().submitAnswer(answer)
}

/**
 * 把所选清单编码为对应 Answer 并提交（本项目为整批提交语义）。
 * - card / tribute：一次提交所选清单（空清单 = 无选择）
 * - sum：一次提交所选清单
 * - unselect：逐张提交（neos incremental），一次只提交 selected[0]；空清单 = 完成/收尾（走 defaultResponse）
 */
export function submitSelection(derived: DerivedSelection, selected: RequestCard[]): void {
  switch (derived.kind) {
    case 'card':
      submitAnswer({ kind: 'card', cards: selected })
      return
    case 'tribute':
      submitAnswer({ kind: 'tribute', cards: selected })
      return
    case 'sum':
      submitAnswer({ kind: 'sum', cards: selected })
      return
    case 'unselect':
      submitAnswer({ kind: 'unselect', card: selected[0] ?? null })
      return
  }
}

/** 取消当前询问（走引擎消息的 defaultResponse）。SelectSum 协议无取消语义。 */
export function cancelSelection(derived: DerivedSelection): void {
  switch (derived.kind) {
    case 'card':
      submitAnswer({ kind: 'card', cards: null })
      return
    case 'tribute':
      submitAnswer({ kind: 'tribute', cards: null })
      return
    case 'unselect':
      submitAnswer({ kind: 'unselect', card: null })
      return
    case 'sum':
      return
  }
}
