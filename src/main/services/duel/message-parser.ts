import {
  YGOProMsgSelectIdleCmd,
  IdleCmdType,
  YGOProMsgSelectBattleCmd,
  BattleCmdType,
  YGOProMsgSelectPlace,
  YGOProMsgSelectDisField,
  YGOProMsgSelectChain,
  YGOProMsgSelectCard,
  YGOProMsgSelectTribute,
  YGOProMsgSelectPosition,
  YGOProMsgSelectYesNo,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectOption,
  YGOProMsgAnnounceAttrib,
  YGOProMsgAnnounceRace,
  YGOProMsgAnnounceNumber,
  YGOProMsgAnnounceCard
} from 'ygopro-msg-encode'
import { _OcgcoreConstants } from 'koishipro-core.js'
import { EnginePendingAction, EngineActionOption, CardLocation, CdbCard } from '@shared/index'
import { cdbService } from '../../db/cdbService'
import { getEffectDescText, getSystemDescText } from './strings-service'

const { OcgcoreScriptConstants } = _OcgcoreConstants

export type EngineCardResolver = (
  controller: number,
  location: number,
  sequence: number,
  code?: number
) => { instanceId: string; card?: CdbCard } | undefined

export function isInteractiveQuery(msg: unknown): boolean {
  return (
    msg instanceof YGOProMsgSelectIdleCmd ||
    msg instanceof YGOProMsgSelectBattleCmd ||
    msg instanceof YGOProMsgSelectPlace ||
    msg instanceof YGOProMsgSelectDisField ||
    msg instanceof YGOProMsgSelectChain ||
    msg instanceof YGOProMsgSelectCard ||
    msg instanceof YGOProMsgSelectTribute ||
    msg instanceof YGOProMsgSelectPosition ||
    msg instanceof YGOProMsgSelectYesNo ||
    msg instanceof YGOProMsgSelectEffectYn ||
    msg instanceof YGOProMsgSelectOption ||
    msg instanceof YGOProMsgAnnounceAttrib ||
    msg instanceof YGOProMsgAnnounceRace ||
    msg instanceof YGOProMsgAnnounceNumber ||
    msg instanceof YGOProMsgAnnounceCard
  )
}

function optionId(
  prefix: string,
  card: { code: number; sequence: number },
  suffix?: unknown
): string {
  return [prefix, card.code, card.sequence, suffix ?? ''].filter((v) => v !== '').join('-')
}

function buildCardOption(
  prefix: string,
  label: string,
  type: EngineActionOption['type'],
  card: { code: number; controller?: number; location: number; sequence: number },
  fallbackPlayer: 0 | 1,
  rawPayload: unknown,
  resolver?: EngineCardResolver,
  suffix?: unknown
): EngineActionOption {
  const location = card.location || CardLocation.HAND
  const resolved = resolver?.(card.controller ?? fallbackPlayer, location, card.sequence, card.code)
  return {
    id: optionId(prefix, card, suffix),
    label,
    type,
    instanceId: resolved?.instanceId,
    cardCode: card.code,
    controller: (card.controller ?? fallbackPlayer) as 0 | 1,
    location,
    sequence: card.sequence,
    rawPayload
  }
}

export function parsePendingAction(
  msg: unknown,
  resolver?: EngineCardResolver
): EnginePendingAction {
  const options: EngineActionOption[] = []
  const player: 0 | 1 =
    typeof (msg as { player?: number })?.player === 'number' &&
    (msg as { player?: number }).player === 1
      ? 1
      : 0

  const cardName = (code: number): string => cdbService.getCardById(code)?.name || String(code)
  const activateLabel = (code: number, desc: number): string => {
    const text = getEffectDescText(desc, cardName(code))
    return text ? `发动 [${cardName(code)}]: ${text}` : `发动 [${cardName(code)}]`
  }

  if (msg instanceof YGOProMsgSelectIdleCmd) {
    for (const card of msg.summonableCards) {
      options.push(
        buildCardOption(
          'summon',
          `召唤 [${cardName(card.code)}]`,
          'SUMMON',
          card,
          player,
          { type: IdleCmdType.SUMMON, card },
          resolver
        )
      )
    }

    for (const card of msg.spSummonableCards) {
      options.push(
        buildCardOption(
          'spsummon',
          `特殊召唤 [${cardName(card.code)}]`,
          'SPSUMMON',
          card,
          player,
          { type: IdleCmdType.SPSUMMON, card },
          resolver
        )
      )
    }

    for (const card of msg.ssetableCards) {
      options.push(
        buildCardOption(
          'sset',
          `盖放 [${cardName(card.code)}]`,
          'SSET',
          card,
          player,
          { type: IdleCmdType.SSET, card },
          resolver
        )
      )
    }

    for (const card of msg.msetableCards) {
      options.push(
        buildCardOption(
          'mset',
          `盖放怪兽 [${cardName(card.code)}]`,
          'MSET',
          card,
          player,
          { type: IdleCmdType.MSET, card },
          resolver
        )
      )
    }

    for (const card of msg.reposableCards) {
      options.push(
        buildCardOption(
          'repos',
          `改变形式 [${cardName(card.code)}]`,
          'REPOS',
          card,
          player,
          { type: IdleCmdType.REPOS, card },
          resolver
        )
      )
    }

    for (const card of msg.activatableCards) {
      options.push(
        buildCardOption(
          'activate',
          activateLabel(card.code, card.desc),
          'ACTIVATE',
          card,
          player,
          { type: IdleCmdType.ACTIVATE, card },
          resolver,
          card.desc
        )
      )
    }

    if (msg.canBp) {
      options.push({
        id: 'to-bp',
        label: '进入战斗阶段 (Battle Phase)',
        type: 'BP',
        rawPayload: { type: IdleCmdType.TO_BP }
      })
    }

    if (msg.canEp) {
      options.push({
        id: 'to-ep',
        label: '结束回合 (End Phase)',
        type: 'EP',
        rawPayload: { type: IdleCmdType.TO_EP }
      })
    }

    return {
      kind: 'IDLE_CMD',
      player,
      title: `Player ${player} 主要阶段行动`,
      subtitle: '请选择要执行的操作',
      options
    }
  }

  if (msg instanceof YGOProMsgSelectBattleCmd) {
    for (const card of msg.attackableCards) {
      options.push(
        buildCardOption(
          'attack',
          `攻击 [${cardName(card.code)}]`,
          'ATTACK',
          card,
          player,
          { type: BattleCmdType.ATTACK, card },
          resolver
        )
      )
    }

    for (const card of msg.activatableCards) {
      options.push(
        buildCardOption(
          'activate-bp',
          activateLabel(card.code, card.desc),
          'ACTIVATE',
          card,
          player,
          { type: BattleCmdType.ACTIVATE, card },
          resolver,
          card.desc
        )
      )
    }

    if (msg.canM2) {
      options.push({
        id: 'to-m2',
        label: '主要阶段2 (Main Phase 2)',
        type: 'M2',
        rawPayload: { type: BattleCmdType.TO_M2 }
      })
    }

    if (msg.canEp) {
      options.push({
        id: 'to-ep',
        label: '结束回合 (End Phase)',
        type: 'EP',
        rawPayload: { type: BattleCmdType.TO_EP }
      })
    }

    return {
      kind: 'BATTLE_CMD',
      player,
      title: `Player ${player} 战斗阶段行动`,
      subtitle: '请选择攻击目标或进入下一阶段',
      options
    }
  }

  if (msg instanceof YGOProMsgSelectPlace || msg instanceof YGOProMsgSelectDisField) {
    const places = msg.getSelectablePlaces()
    for (const p of places) {
      const isMzone = p.location === OcgcoreScriptConstants.LOCATION_MZONE
      const locName = isMzone ? '怪兽区' : '魔陷区'
      options.push({
        id: `place-${p.player}-${p.location}-${p.sequence}`,
        label: `${p.player === player ? '我方' : '对方'} ${locName} 第 ${p.sequence + 1} 格`,
        type: 'PLACE',
        controller: p.player as 0 | 1,
        location: p.location,
        sequence: p.sequence,
        zoneIndex: p.sequence,
        rawPayload: { place: p }
      })
    }
    return {
      kind: 'SELECT_PLACE',
      player,
      title: `Player ${player} 选择卡片放置格位`,
      subtitle: '点击选择要放置的区域格',
      options
    }
  }

  if (msg instanceof YGOProMsgSelectChain) {
    for (let idx = 0; idx < msg.chains.length; idx++) {
      const card = msg.chains[idx]
      const resolved = resolver?.(
        card.controller ?? player,
        card.location,
        card.sequence,
        card.code
      )
      options.push({
        id: `chain-${card.code}-${card.sequence}-${idx}`,
        label: `发动连锁: [${cardName(card.code)}]`,
        type: 'CHAIN',
        instanceId: resolved?.instanceId,
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location,
        rawPayload: { chainIndex: idx }
      })
    }
    options.push({
      id: 'chain-pass',
      label: '放弃发动连锁 (Pass)',
      type: 'PASS',
      rawPayload: { pass: true }
    })
    return {
      kind: 'SELECT_CHAIN',
      player,
      title: `Player ${player} 询问连锁`,
      subtitle: '是否发动卡片或效果进行连锁？',
      options
    }
  }

  if (msg instanceof YGOProMsgSelectCard) {
    for (let idx = 0; idx < msg.cards.length; idx++) {
      const card = msg.cards[idx]
      const resolved = resolver?.(
        card.controller ?? player,
        card.location,
        card.sequence,
        card.code
      )
      options.push({
        id: `select-card-${card.code}-${card.location}-${card.sequence}-${idx}`,
        label: `选择 [${cardName(card.code)}]`,
        type: 'SELECT_CARD',
        instanceId: resolved?.instanceId,
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        location: card.location,
        sequence: card.sequence,
        rawPayload: { index: idx, card }
      })
    }
    if (msg.cancelable) {
      options.push({
        id: 'select-card-cancel',
        label: '取消',
        type: 'PASS',
        rawPayload: { cancel: true }
      })
    }
    return {
      kind: 'SELECT_CARD',
      player,
      title: `Player ${player} 请选择卡片`,
      subtitle: `请选择 ${msg.min === msg.max ? msg.min : `${msg.min}~${msg.max}`} 张卡`,
      options,
      canCancel: Boolean(msg.cancelable),
      min: msg.min,
      max: msg.max
    }
  }

  if (msg instanceof YGOProMsgSelectTribute) {
    for (let idx = 0; idx < msg.cards.length; idx++) {
      const card = msg.cards[idx]
      const resolved = resolver?.(
        card.controller ?? player,
        card.location,
        card.sequence,
        card.code
      )
      options.push({
        id: `tribute-${card.code}-${card.location}-${card.sequence}-${idx}`,
        label: `解放 [${cardName(card.code)}]`,
        type: 'TRIBUTE',
        instanceId: resolved?.instanceId,
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        location: card.location,
        sequence: card.sequence,
        rawPayload: { index: idx, card }
      })
    }
    if (msg.cancelable) {
      options.push({
        id: 'tribute-cancel',
        label: '取消',
        type: 'PASS',
        rawPayload: { cancel: true }
      })
    }
    return {
      kind: 'SELECT_TRIBUTE',
      player,
      title: `Player ${player} 请选择解放祭品`,
      subtitle: `请选择 ${msg.min === msg.max ? msg.min : `${msg.min}~${msg.max}`} 只怪兽作为祭品`,
      options,
      canCancel: Boolean(msg.cancelable),
      min: msg.min,
      max: msg.max
    }
  }

  if (msg instanceof YGOProMsgSelectPosition) {
    const posMap: [number, string][] = [
      [0x1, '表侧攻击表示'],
      [0x4, '表侧守备表示'],
      [0x8, '里侧守备表示'],
      [0x2, '里侧攻击表示']
    ]
    for (const [bit, label] of posMap) {
      if ((msg.positions & bit) !== 0) {
        options.push({
          id: `pos-${bit}`,
          label,
          type: 'POSITION',
          rawPayload: { position: bit }
        })
      }
    }
    return {
      kind: 'SELECT_POSITION',
      player,
      title: `Player ${player} 请选择表示形式`,
      options
    }
  }

  if (msg instanceof YGOProMsgSelectEffectYn) {
    const info = msg.code ? cdbService.getCardById(msg.code) : null
    const cardNameText = info ? info.name : ''
    const resolved = resolver?.(msg.controller ?? player, msg.location, msg.sequence, msg.code)
    const descText = getEffectDescText(msg.desc, cardNameText)
    options.push({
      id: 'effectyn-yes',
      label: '发动',
      type: 'YES',
      instanceId: resolved?.instanceId,
      rawPayload: { value: 1 }
    })
    options.push({
      id: 'effectyn-no',
      label: '放弃',
      type: 'NO',
      instanceId: resolved?.instanceId,
      rawPayload: { value: 0 }
    })
    return {
      kind: 'SELECT_EFFECTYN',
      player,
      title: descText ?? `是否发动【${cardNameText}】的效果？`,
      options
    }
  }

  if (msg instanceof YGOProMsgSelectYesNo) {
    const yesDesc = getEffectDescText(msg.desc, '') ?? getSystemDescText(msg.desc, '')
    options.push({
      id: 'yesno-yes',
      label: '是 (Yes)',
      type: 'YES',
      rawPayload: { value: 1 }
    })
    options.push({
      id: 'yesno-no',
      label: '否 (No)',
      type: 'NO',
      rawPayload: { value: 0 }
    })
    return {
      kind: 'SELECT_YESNO',
      player,
      title: yesDesc ?? `Player ${player} 提示确认`,
      options
    }
  }

  if (msg instanceof YGOProMsgSelectOption) {
    for (let i = 0; i < msg.options.length; i++) {
      const optCode = msg.options[i]
      const optText = getEffectDescText(optCode, '') ?? getSystemDescText(optCode, '')
      options.push({
        id: `opt-${i}`,
        label: optText ?? `选项 ${i + 1}`,
        type: 'OPTION',
        rawPayload: { index: i, optCode }
      })
    }
    return {
      kind: 'SELECT_OPTION',
      player,
      title: `Player ${player} 请选择选项`,
      options
    }
  }

  if (msg instanceof YGOProMsgAnnounceAttrib) {
    const SC = OcgcoreScriptConstants
    const attribs: [number, string][] = [
      [SC.ATTRIBUTE_EARTH, '地'],
      [SC.ATTRIBUTE_WATER, '水'],
      [SC.ATTRIBUTE_FIRE, '炎'],
      [SC.ATTRIBUTE_WIND, '风'],
      [SC.ATTRIBUTE_LIGHT, '光'],
      [SC.ATTRIBUTE_DARK, '暗'],
      [SC.ATTRIBUTE_DIVINE, '神']
    ]
    for (const [bit, label] of attribs) {
      if ((msg.availableAttributes & bit) !== 0) {
        options.push({
          id: `attrib-${bit}`,
          label,
          type: 'ANNOUNCE',
          rawPayload: { value: bit }
        })
      }
    }
    return {
      kind: 'ANNOUNCE',
      player,
      title: `Player ${player} 宣言属性`,
      subtitle: msg.count > 1 ? `请选择 ${msg.count} 种属性` : undefined,
      options
    }
  }

  if (msg instanceof YGOProMsgAnnounceRace) {
    const SC = OcgcoreScriptConstants
    const races: [number, string][] = [
      [SC.RACE_DRAGON, '龙'],
      [SC.RACE_SPELLCASTER, '魔法师'],
      [SC.RACE_WARRIOR, '战士'],
      [SC.RACE_BEASTWARRIOR, '兽战士'],
      [SC.RACE_BEAST, '兽'],
      [SC.RACE_FAIRY, '天使'],
      [SC.RACE_FIEND, '恶魔'],
      [SC.RACE_ZOMBIE, '不死'],
      [SC.RACE_MACHINE, '机械'],
      [SC.RACE_AQUA, '水'],
      [SC.RACE_PYRO, '炎'],
      [SC.RACE_ROCK, '岩石'],
      [SC.RACE_WINDBEAST, '鸟兽'],
      [SC.RACE_PLANT, '植物'],
      [SC.RACE_INSECT, '昆虫'],
      [SC.RACE_THUNDER, '雷'],
      [SC.RACE_DINOSAUR, '恐龙'],
      [SC.RACE_FISH, '鱼'],
      [SC.RACE_SEASERPENT, '海龙'],
      [SC.RACE_REPTILE, '爬虫'],
      [SC.RACE_PSYCHO, '念动力'],
      [SC.RACE_DIVINE, '幻神兽'],
      [SC.RACE_CREATORGOD, '创世神'],
      [SC.RACE_WYRM, '幻龙'],
      [SC.RACE_CYBERSE, '电子界'],
      [SC.RACE_ILLUSION, '幻影']
    ]
    for (const [bit, label] of races) {
      if ((msg.availableRaces & bit) !== 0) {
        options.push({
          id: `race-${bit}`,
          label,
          type: 'ANNOUNCE',
          rawPayload: { value: bit }
        })
      }
    }
    return {
      kind: 'ANNOUNCE',
      player,
      title: `Player ${player} 宣言种族`,
      subtitle: msg.count > 1 ? `请选择 ${msg.count} 种种族` : undefined,
      options
    }
  }

  if (msg instanceof YGOProMsgAnnounceNumber) {
    for (const num of msg.numbers) {
      options.push({
        id: `annnum-${num}`,
        label: String(num),
        type: 'ANNOUNCE',
        rawPayload: { value: num }
      })
    }
    return {
      kind: 'ANNOUNCE',
      player,
      title: `Player ${player} 宣言数字`,
      options
    }
  }

  if (msg instanceof YGOProMsgAnnounceCard) {
    options.push({
      id: 'anncard-free',
      label: '指定卡名宣布',
      type: 'ANNOUNCE',
      rawPayload: { freeSearch: true }
    })
    return {
      kind: 'ANNOUNCE',
      player,
      title: `Player ${player} 宣言卡片`,
      subtitle: `请在搜索面板中选择要宣言的卡名（共 ${msg.count} 次）`,
      options
    }
  }

  return {
    kind: 'WAITING',
    player,
    title: '等待核心响应',
    options: []
  }
}
