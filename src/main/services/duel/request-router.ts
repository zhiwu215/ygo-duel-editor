import {
  YGOProMsgSelectIdleCmd,
  YGOProMsgSelectBattleCmd,
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
  YGOProMsgAnnounceCard
} from 'ygopro-msg-encode'
import { EngineRequest, RequestCard, RequestData, RequestPlace } from '@shared/engine/protocol'
import { getEffectDescText, getSystemDescText } from './strings-service'

export interface RouteContext {
  id: string
  seq: number
  descHint?: number
}

function normalizePlayer(v: number | undefined, fallback: 0 | 1): 0 | 1 {
  return v === 1 ? 1 : fallback
}

function toRequestCard(info: {
  code: number
  controller: number
  location: number
  sequence: number
  desc?: number
  directAttack?: number
  opParam?: number
  counterCount?: number
}): RequestCard {
  return {
    code: info.code,
    controller: normalizePlayer(info.controller, 0),
    location: info.location,
    sequence: info.sequence,
    desc: info.desc,
    directAttackable: info.directAttack === undefined ? undefined : info.directAttack === 1,
    opParam: info.opParam,
    counterCount: info.counterCount
  }
}

export function routeRequest(msg: unknown, ctx: RouteContext): EngineRequest | null {
  let player: 0 | 1
  let kind: RequestData['kind']
  let identifier: number
  let title: string
  let subtitle: string | undefined
  let data: RequestData

  if (msg instanceof YGOProMsgSelectIdleCmd) {
    player = normalizePlayer(msg.player, 0)
    kind = 'idle'
    identifier = YGOProMsgSelectIdleCmd.identifier
    title = `Player ${player} 主要阶段行动`
    data = {
      kind: 'idle',
      summonable: msg.summonableCards.map(toRequestCard),
      spSummonable: msg.spSummonableCards.map(toRequestCard),
      msetable: msg.msetableCards.map(toRequestCard),
      ssetable: msg.ssetableCards.map(toRequestCard),
      reposable: msg.reposableCards.map(toRequestCard),
      activatable: msg.activatableCards.map(toRequestCard),
      canBp: msg.canBp === 1,
      canEp: msg.canEp === 1,
      canShuffle: msg.canShuffle === 1
    }
  } else if (msg instanceof YGOProMsgSelectBattleCmd) {
    player = normalizePlayer(msg.player, 0)
    kind = 'battle'
    identifier = YGOProMsgSelectBattleCmd.identifier
    title = `Player ${player} 战斗阶段行动`
    data = {
      kind: 'battle',
      attackable: msg.attackableCards.map(toRequestCard),
      activatable: msg.activatableCards.map(toRequestCard),
      canM2: msg.canM2 === 1,
      canEp: msg.canEp === 1
    }
  } else if (msg instanceof YGOProMsgSelectCard) {
    player = normalizePlayer(msg.player, 0)
    kind = 'card'
    identifier = YGOProMsgSelectCard.identifier
    title =
      ctx.descHint !== undefined
        ? (getSystemDescText(ctx.descHint, '') ?? `Player ${player} 请选择卡片`)
        : `Player ${player} 请选择卡片`
    subtitle = msg.min === msg.max ? `请选择 ${msg.min} 张` : `请选择 ${msg.min}~${msg.max} 张`
    data = {
      kind: 'card',
      cards: msg.cards.map(toRequestCard),
      min: msg.min,
      max: msg.max,
      cancelable: msg.cancelable === 1
    }
  } else if (msg instanceof YGOProMsgSelectTribute) {
    player = normalizePlayer(msg.player, 0)
    kind = 'tribute'
    identifier = YGOProMsgSelectTribute.identifier
    title = `Player ${player} 请选择解放`
    subtitle = msg.min === msg.max ? `请选择 ${msg.min} 只` : `请选择 ${msg.min}~${msg.max} 只`
    data = {
      kind: 'tribute',
      cards: msg.cards.map(toRequestCard),
      min: msg.min,
      max: msg.max,
      cancelable: msg.cancelable === 1
    }
  } else if (msg instanceof YGOProMsgSelectChain) {
    player = normalizePlayer(msg.player, 0)
    kind = 'chain'
    identifier = YGOProMsgSelectChain.identifier
    title = `Player ${player} 是否连锁？`
    data = {
      kind: 'chain',
      chains: msg.chains.map(toRequestCard),
      forced: msg.chains.some((c) => c.forced === 1)
    }
  } else if (msg instanceof YGOProMsgSelectDisField) {
    player = normalizePlayer(msg.player, 0)
    kind = 'disfield'
    identifier = YGOProMsgSelectDisField.identifier
    title = `Player ${player} 选择禁用区域`
    data = { kind: 'disfield', places: toPlaces(msg), count: msg.count }
  } else if (msg instanceof YGOProMsgSelectPlace) {
    player = normalizePlayer(msg.player, 0)
    kind = 'place'
    identifier = YGOProMsgSelectPlace.identifier
    title = `Player ${player} 选择放置区域`
    data = { kind: 'place', places: toPlaces(msg), count: msg.count }
  } else if (msg instanceof YGOProMsgSelectPosition) {
    player = normalizePlayer(msg.player, 0)
    kind = 'position'
    identifier = YGOProMsgSelectPosition.identifier
    title = `Player ${player} 请选择表示形式`
    data = {
      kind: 'position',
      positions: decodePositions(msg.positions),
      code: msg.code > 0 ? msg.code : undefined
    }
  } else if (msg instanceof YGOProMsgSelectEffectYn || msg instanceof YGOProMsgSelectYesNo) {
    player = normalizePlayer(msg.player, 0)
    kind = 'yesno'
    identifier =
      msg instanceof YGOProMsgSelectEffectYn
        ? YGOProMsgSelectEffectYn.identifier
        : YGOProMsgSelectYesNo.identifier
    const card =
      msg instanceof YGOProMsgSelectEffectYn
        ? toRequestCard({
            code: msg.code,
            controller: msg.controller ?? player,
            location: msg.location,
            sequence: msg.sequence
          })
        : undefined
    const descText = getEffectDescText(msg.desc, card ? card.code.toString() : '')
    title = descText ?? getSystemDescText(msg.desc, '') ?? `Player ${player} 请确认`
    data = { kind: 'yesno', desc: msg.desc, card }
  } else if (msg instanceof YGOProMsgSelectOption) {
    player = normalizePlayer(msg.player, 0)
    kind = 'option'
    identifier = YGOProMsgSelectOption.identifier
    title = `Player ${player} 请选择选项`
    data = {
      kind: 'option',
      options: msg.options.map((code) => ({
        code,
        text: getEffectDescText(code) ?? getSystemDescText(code)
      }))
    }
  } else if (msg instanceof YGOProMsgSelectCounter) {
    player = normalizePlayer(msg.player, 0)
    kind = 'counter'
    identifier = YGOProMsgSelectCounter.identifier
    title = `Player ${player} 请取除指示物`
    data = {
      kind: 'counter',
      counterType: msg.counterType,
      counterCount: msg.counterCount,
      count: msg.count,
      cards: msg.cards.map(toRequestCard)
    }
  } else if (msg instanceof YGOProMsgSelectSum) {
    player = normalizePlayer(msg.player, 0)
    kind = 'sum'
    identifier = YGOProMsgSelectSum.identifier
    title = `Player ${player} 请选择合计数值匹配的卡`
    data = {
      kind: 'sum',
      mode: msg.mode,
      sumVal: msg.sumVal,
      min: msg.min,
      max: msg.max,
      count: msg.count,
      mustSelect: msg.mustSelectCards.map(toRequestCard),
      cards: msg.cards.map(toRequestCard)
    }
  } else if (msg instanceof YGOProMsgSortCard) {
    player = normalizePlayer(msg.player, 0)
    kind = 'sort'
    identifier = YGOProMsgSortCard.identifier
    title = `Player ${player} 请对卡片排序`
    data = { kind: 'sort', cards: msg.cards.map(toRequestCard) }
  } else if (msg instanceof YGOProMsgSelectUnselectCard) {
    player = normalizePlayer(msg.player, 0)
    kind = 'unselect'
    identifier = YGOProMsgSelectUnselectCard.identifier
    title = `Player ${player} 请选择/取消选择卡片`
    data = {
      kind: 'unselect',
      finishable: msg.finishable === 1,
      cancelable: msg.cancelable === 1,
      min: msg.min,
      max: msg.max,
      selectable: msg.selectableCards.map(toRequestCard),
      unselectable: msg.unselectableCards.map(toRequestCard)
    }
  } else if (msg instanceof YGOProMsgRockPaperScissors) {
    player = normalizePlayer(msg.player, 0)
    kind = 'rps'
    identifier = YGOProMsgRockPaperScissors.identifier
    title = '猜拳决定先攻'
    data = { kind: 'rps' }
  } else if (
    msg instanceof YGOProMsgAnnounceAttrib ||
    msg instanceof YGOProMsgAnnounceRace ||
    msg instanceof YGOProMsgAnnounceNumber ||
    msg instanceof YGOProMsgAnnounceCard
  ) {
    player = normalizePlayer(msg.player, 0)
    kind = 'announce'
    identifier =
      msg instanceof YGOProMsgAnnounceAttrib
        ? YGOProMsgAnnounceAttrib.identifier
        : msg instanceof YGOProMsgAnnounceRace
          ? YGOProMsgAnnounceRace.identifier
          : msg instanceof YGOProMsgAnnounceNumber
            ? YGOProMsgAnnounceNumber.identifier
            : YGOProMsgAnnounceCard.identifier
    const announceType =
      msg instanceof YGOProMsgAnnounceAttrib
        ? ('attrib' as const)
        : msg instanceof YGOProMsgAnnounceRace
          ? ('race' as const)
          : msg instanceof YGOProMsgAnnounceNumber
            ? ('number' as const)
            : ('card' as const)
    title =
      announceType === 'attrib'
        ? `Player ${player} 宣言属性`
        : announceType === 'race'
          ? `Player ${player} 宣言种族`
          : announceType === 'number'
            ? `Player ${player} 宣言数字`
            : `Player ${player} 宣言卡片`
    subtitle = msg.count > 1 ? `请选择 ${msg.count} 种` : undefined
    data = {
      kind: 'announce',
      announceType,
      count: msg.count,
      availableMask:
        msg instanceof YGOProMsgAnnounceAttrib
          ? msg.availableAttributes
          : msg instanceof YGOProMsgAnnounceRace
            ? msg.availableRaces
            : undefined,
      numbers: msg instanceof YGOProMsgAnnounceNumber ? msg.numbers : undefined
    }
  } else {
    return null
  }

  return {
    id: ctx.id,
    seq: ctx.seq,
    player,
    kind,
    identifier,
    title,
    subtitle,
    descHint: ctx.descHint,
    data
  }
}

function toPlaces(msg: YGOProMsgSelectPlace | YGOProMsgSelectDisField): RequestPlace[] {
  const fallback = normalizePlayer(msg.player, 0)
  return msg.getSelectablePlaces().map((p) => ({
    controller: normalizePlayer(p.player, fallback),
    location: p.location,
    sequence: p.sequence
  }))
}

function decodePositions(mask: number): number[] {
  const out: number[] = []
  for (const bit of [0x1, 0x2, 0x4, 0x8]) {
    if ((mask & bit) !== 0) out.push(bit)
  }
  return out
}
