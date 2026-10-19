import {
  YGOProMsgSelectIdleCmd,
  IdleCmdType,
  YGOProMsgSelectBattleCmd,
  BattleCmdType,
  YGOProMsgSelectCard,
  YGOProMsgSelectTribute,
  YGOProMsgSelectChain,
  YGOProMsgSelectPlace,
  YGOProMsgSelectDisField,
  YGOProMsgSelectPosition,
  YGOProMsgSelectYesNo,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectOption,
  YGOProMsgSelectCounter,
  YGOProMsgSelectSum,
  YGOProMsgSortCard,
  YGOProMsgSelectUnselectCard,
  YGOProMsgRockPaperScissors,
  YGOProMsgAnnounceAttrib,
  YGOProMsgAnnounceRace,
  YGOProMsgAnnounceNumber,
  YGOProMsgAnnounceCard,
  IndexResponse,
  HandResult
} from 'ygopro-msg-encode'
import { Answer } from '@shared/engine/protocol'
import { cdbService } from '../../db/cdbService'

const IDLE_CMD_MAP: Record<string, IdleCmdType> = {
  SUMMON: IdleCmdType.SUMMON,
  SPSUMMON: IdleCmdType.SPSUMMON,
  MSET: IdleCmdType.MSET,
  SSET: IdleCmdType.SSET,
  REPOS: IdleCmdType.REPOS,
  ACTIVATE: IdleCmdType.ACTIVATE,
  TO_BP: IdleCmdType.TO_BP,
  TO_EP: IdleCmdType.TO_EP,
  SHUFFLE: IdleCmdType.SHUFFLE
}

const BATTLE_CMD_MAP: Record<string, BattleCmdType> = {
  ATTACK: BattleCmdType.ATTACK,
  ACTIVATE: BattleCmdType.ACTIVATE,
  TO_M2: BattleCmdType.TO_M2,
  TO_EP: BattleCmdType.TO_EP
}

const HAND_RESULT_MAP: Record<string, HandResult> = {
  rock: HandResult.ROCK,
  scissors: HandResult.SCISSORS,
  paper: HandResult.PAPER
}

export function encodeAnswer(msg: unknown, answer: Answer): Uint8Array {
  if (msg instanceof YGOProMsgSelectIdleCmd) {
    const a = assertIdle(answer)
    const type = IDLE_CMD_MAP[a.cmd]
    if (type === undefined) throw new Error(`未知的 idle 命令: ${a.cmd}`)
    if (
      (type === IdleCmdType.TO_BP || type === IdleCmdType.TO_EP || type === IdleCmdType.SHUFFLE) ===
        false &&
      !a.card
    ) {
      throw new Error('idle 卡片操作需要指定 card。')
    }
    return msg.prepareResponse(type, a.card)
  }

  if (msg instanceof YGOProMsgSelectBattleCmd) {
    const a = assertBattle(answer)
    const type = BATTLE_CMD_MAP[a.cmd]
    if (type === undefined) throw new Error(`未知的 battle 命令: ${a.cmd}`)
    if ((type === BattleCmdType.TO_M2 || type === BattleCmdType.TO_EP) === false && !a.card) {
      throw new Error('battle 卡片操作需要指定 card。')
    }
    return msg.prepareResponse(type, a.card)
  }

  if (msg instanceof YGOProMsgSelectCard) {
    const a = assertCard(answer)
    if (!a.cards) return msg.defaultResponse()
    return msg.prepareResponse(a.cards)
  }

  if (msg instanceof YGOProMsgSelectTribute) {
    const a = assertTribute(answer)
    if (!a.cards) return msg.defaultResponse()
    return msg.prepareResponse(a.cards)
  }

  if (msg instanceof YGOProMsgSelectChain) {
    const a = assertChain(answer)
    if (!a.card) return msg.defaultResponse()
    return msg.prepareResponse(a.card)
  }

  if (msg instanceof YGOProMsgSelectPlace || msg instanceof YGOProMsgSelectDisField) {
    const a = assertPlace(answer)
    return msg.prepareResponse(
      a.places.map((p) => ({ player: p.controller, location: p.location, sequence: p.sequence }))
    )
  }

  if (msg instanceof YGOProMsgSelectPosition) {
    const a = assertKind(answer, 'position')
    return msg.prepareResponse(a.position)
  }

  if (msg instanceof YGOProMsgSelectEffectYn || msg instanceof YGOProMsgSelectYesNo) {
    const a = assertKind(answer, 'yesno')
    return msg.prepareResponse(a.yes)
  }

  if (msg instanceof YGOProMsgSelectOption) {
    const a = assertKind(answer, 'option')
    return msg.prepareResponse(IndexResponse(a.index))
  }

  if (msg instanceof YGOProMsgSelectCounter) {
    const a = assertKind(answer, 'counter')
    return msg.prepareResponse(
      a.counters.map((c) => {
        const index = msg.cards.findIndex(
          (card) =>
            card.code === c.card.code &&
            card.controller === c.card.controller &&
            card.location === c.card.location &&
            card.sequence === c.card.sequence
        )
        if (index < 0) throw new Error('指示物请求中的卡片不在候选列表内。')
        return { card: IndexResponse(index), count: c.count }
      })
    )
  }

  if (msg instanceof YGOProMsgSelectSum) {
    const a = assertKind(answer, 'sum')
    return msg.prepareResponse(a.cards)
  }

  if (msg instanceof YGOProMsgSortCard) {
    const a = assertKind(answer, 'sort')
    if (!a.cards) return msg.defaultResponse()
    return msg.prepareResponse(a.cards)
  }

  if (msg instanceof YGOProMsgSelectUnselectCard) {
    const a = assertKind(answer, 'unselect')
    if (!a.card) return msg.defaultResponse()
    return msg.prepareResponse(a.card)
  }

  if (msg instanceof YGOProMsgRockPaperScissors) {
    const a = assertKind(answer, 'rps')
    const hand = HAND_RESULT_MAP[a.hand]
    if (hand === undefined) throw new Error(`未知的猜拳选择: ${a.hand}`)
    return msg.prepareResponse(hand)
  }

  if (msg instanceof YGOProMsgAnnounceAttrib || msg instanceof YGOProMsgAnnounceRace) {
    const a = assertKind(answer, 'announce')
    return msg.prepareResponse(a.value)
  }

  if (msg instanceof YGOProMsgAnnounceNumber) {
    const a = assertKind(answer, 'announce')
    return msg.prepareResponse(a.value)
  }

  if (msg instanceof YGOProMsgAnnounceCard) {
    const a = assertKind(answer, 'announce')
    if (!a.value) throw new Error('宣言卡片需要 cardCode。')
    return msg.prepareResponse(a.value)
  }

  const msgName = (msg as { constructor?: { name?: string } }).constructor?.name ?? 'unknown'
  throw new Error(`不支持的引擎询问类型: ${msgName}`)
}

export function describeAnswer(msg: unknown, answer: Answer): string {
  const cardName = (code?: number): string =>
    code === undefined ? '' : cdbService.getCardById(code)?.name || String(code)
  const a = answer as Answer & {
    cmd?: string
    card?: { code: number }
    cards?: { code: number }[] | null
  }

  switch (a.kind) {
    case 'idle':
      return `Player ${playerOf(msg)}: ${IDLE_TEXT[a.cmd ?? ''] ?? a.cmd} [${cardName(a.card?.code)}]`
    case 'battle': {
      const text = BATTLE_TEXT[a.cmd ?? ''] ?? a.cmd
      return a.cmd === 'ATTACK'
        ? `Player ${playerOf(msg)}: 攻击宣言 [${cardName(a.card?.code)}]`
        : `Player ${playerOf(msg)}: ${text}`
    }
    case 'card':
      return a.cards
        ? `选择 ${a.cards.length} 张: [${a.cards.map((c) => cardName(c.code)).join(', ')}]`
        : '取消选择'
    case 'tribute':
      return a.cards
        ? `解放 ${a.cards.length} 只: [${a.cards.map((c) => cardName(c.code)).join(', ')}]`
        : '取消解放'
    case 'chain':
      return a.card ? `连锁发动 [${cardName(a.card.code)}]` : '放弃连锁'
    case 'place':
      return '选择放置区域'
    case 'position':
      return '选择表示形式'
    case 'yesno':
      return a.yes ? '选择: 是' : '选择: 否'
    case 'option':
      return `选择选项 ${a.index + 1}`
    case 'counter':
      return `取除指示物 ×${a.counters.reduce((s, c) => s + c.count, 0)}`
    case 'sum':
      return `选择合计 ${a.cards.length} 张`
    case 'sort':
      return a.cards ? '对卡片排序' : '不排序'
    case 'unselect':
      return a.card ? `取消选择 [${cardName(a.card.code)}]` : '确认/取消'
    case 'rps':
      return `猜拳: ${a.hand}`
    case 'announce':
      return `宣言: ${a.value}`
  }
}

const IDLE_TEXT: Record<string, string> = {
  SUMMON: '通常召唤',
  SPSUMMON: '特殊召唤',
  MSET: '盖放怪兽',
  SSET: '盖放魔陷',
  REPOS: '变更表示形式',
  ACTIVATE: '发动',
  TO_BP: '进入战斗阶段',
  TO_EP: '结束回合',
  SHUFFLE: '洗手牌'
}

const BATTLE_TEXT: Record<string, string> = {
  ATTACK: '攻击宣言',
  ACTIVATE: '发动',
  TO_M2: '进入主要阶段2',
  TO_EP: '结束回合'
}

function playerOf(msg: unknown): number {
  const p = (msg as { player?: number }).player
  return p === 1 ? 1 : 0
}

function assertIdle(answer: Answer): Extract<Answer, { kind: 'idle' }> {
  if (answer.kind !== 'idle') throw new Error('idle 请求需要 idle 答案。')
  return answer
}
function assertBattle(answer: Answer): Extract<Answer, { kind: 'battle' }> {
  if (answer.kind !== 'battle') throw new Error('battle 请求需要 battle 答案。')
  return answer
}
function assertCard(answer: Answer): Extract<Answer, { kind: 'card' }> {
  if (answer.kind !== 'card') throw new Error('选卡请求需要 card 答案。')
  return answer
}
function assertTribute(answer: Answer): Extract<Answer, { kind: 'tribute' }> {
  if (answer.kind !== 'tribute') throw new Error('解放请求需要 tribute 答案。')
  return answer
}
function assertChain(answer: Answer): Extract<Answer, { kind: 'chain' }> {
  if (answer.kind !== 'chain') throw new Error('连锁请求需要 chain 答案。')
  return answer
}
function assertPlace(answer: Answer): Extract<Answer, { kind: 'place' }> {
  if (answer.kind !== 'place') throw new Error('区域请求需要 place 答案。')
  return answer
}
function assertKind<K extends Answer['kind']>(
  answer: Answer,
  kind: K
): Extract<Answer, { kind: K }> {
  if (answer.kind !== kind) throw new Error(`${kind} 请求需要 ${kind} 答案。`)
  return answer as Extract<Answer, { kind: K }>
}
