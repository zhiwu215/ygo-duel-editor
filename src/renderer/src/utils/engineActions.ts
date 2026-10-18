import { EngineRequest, RequestCard } from '@shared/engine/protocol'
import { CardLocation } from '@shared/index'

/**
 * 从当前 EngineRequest 推导"这张卡此刻能做什么"（引擎合法动作清单的视图化）。
 * 引擎校验的唯一事实来源是请求数据本身：不在清单里的动作就不会出现。
 */
export interface CardEngineActions {
  /** 动作来源请求种类（决定 answer 用 idle 还是 battle 编码） */
  requestKind: 'idle' | 'battle' | 'chain'
  summon?: RequestCard
  spSummon?: RequestCard
  mset?: RequestCard
  sset?: RequestCard
  repos?: RequestCard
  /** 同一张卡可能有多个可发动效果（不同 desc） */
  activate: RequestCard[]
  attack?: RequestCard
  /** 连锁请求：该卡可连锁发动 */
  chain?: RequestCard
}

function matchCard(
  list: RequestCard[] | undefined,
  card: { code: number; controller: 0 | 1; location: number; sequence: number }
): RequestCard | undefined {
  if (!list) return undefined
  return list.find(
    (c) =>
      c.code === card.code &&
      c.controller === card.controller &&
      c.location === card.location &&
      c.sequence === card.sequence
  )
}

export function deriveCardEngineActions(
  request: EngineRequest | null,
  card: { code: number; controller: 0 | 1; location: number; sequence: number } | null
): CardEngineActions | null {
  if (!request || !card) return null
  const d = request.data
  if (d.kind !== 'idle' && d.kind !== 'battle' && d.kind !== 'chain') return null
  const key = {
    code: card.code,
    controller: card.controller,
    location: card.location,
    sequence: card.sequence
  }

  if (d.kind === 'idle') {
    return {
      requestKind: 'idle',
      summon: matchCard(d.summonable, key),
      spSummon: matchCard(d.spSummonable, key),
      mset: matchCard(d.msetable, key),
      sset: matchCard(d.ssetable, key),
      repos: matchCard(d.reposable, key),
      activate: d.activatable.filter(
        (c) => c.code === key.code && c.controller === key.controller && c.location === key.location && c.sequence === key.sequence
      ),
      attack: undefined,
      chain: undefined
    }
  }

  if (d.kind === 'battle') {
    return {
      requestKind: 'battle',
      summon: undefined,
      spSummon: undefined,
      mset: undefined,
      sset: undefined,
      repos: undefined,
      activate: d.activatable.filter(
        (c) => c.code === key.code && c.controller === key.controller && c.location === key.location && c.sequence === key.sequence
      ),
      attack: matchCard(d.attackable, key),
      chain: undefined
    }
  }

  if (d.kind === 'chain') {
    const chain = d.chains.find(
      (c) => c.code === key.code && c.controller === key.controller && c.location === key.location && c.sequence === key.sequence
    )
    return {
      requestKind: 'chain',
      summon: undefined,
      spSummon: undefined,
      mset: undefined,
      sset: undefined,
      repos: undefined,
      activate: [],
      attack: undefined,
      chain
    }
  }

  return null
}

/** 该卡在当前请求下是否有任何可用动作（用于发光提示） */
export function hasCardEngineActions(request: EngineRequest | null, card: {
  code: number
  controller: 0 | 1
  location: number
  sequence: number
} | null): boolean {
  const actions = deriveCardEngineActions(request, card)
  if (!actions) return false
  return Boolean(
    actions.summon ||
      actions.spSummon ||
      actions.mset ||
      actions.sset ||
      actions.repos ||
      actions.attack ||
      actions.chain ||
      actions.activate.length > 0
  )
}

/** 引擎手牌区的可特殊召唤检查（额外区显示特召按钮用） */
export function isExtraDeckLocation(location: number): boolean {
  return location === CardLocation.EXTRA
}
