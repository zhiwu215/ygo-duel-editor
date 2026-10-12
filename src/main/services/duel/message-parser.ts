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
import { EnginePendingAction, EngineActionOption, CardLocation } from '@shared/index'
import { cdbService } from '../../db/cdbService'

const { OcgcoreScriptConstants } = _OcgcoreConstants

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

export function parsePendingAction(msg: unknown): EnginePendingAction {
  const options: EngineActionOption[] = []
  const player: 0 | 1 =
    typeof (msg as { player?: number })?.player === 'number' &&
    (msg as { player?: number }).player === 1
      ? 1
      : 0

  if (msg instanceof YGOProMsgSelectIdleCmd) {
    for (const card of msg.summonableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `summon-${card.code}-${card.sequence}`,
        label: `召唤 [${info?.name || card.code}]`,
        type: 'SUMMON',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location || CardLocation.HAND,
        rawPayload: { type: IdleCmdType.SUMMON, card }
      })
    }

    for (const card of msg.spSummonableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `spsummon-${card.code}-${card.sequence}`,
        label: `特殊召唤 [${info?.name || card.code}]`,
        type: 'SPSUMMON',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location || CardLocation.HAND,
        rawPayload: { type: IdleCmdType.SPSUMMON, card }
      })
    }

    for (const card of msg.ssetableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `sset-${card.code}-${card.sequence}`,
        label: `盖放 [${info?.name || card.code}]`,
        type: 'SSET',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location || CardLocation.HAND,
        rawPayload: { type: IdleCmdType.SSET, card }
      })
    }

    for (const card of msg.msetableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `mset-${card.code}-${card.sequence}`,
        label: `盖放怪兽 [${info?.name || card.code}]`,
        type: 'MSET',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location || CardLocation.HAND,
        rawPayload: { type: IdleCmdType.MSET, card }
      })
    }

    for (const card of msg.reposableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `repos-${card.code}-${card.sequence}`,
        label: `改变形式 [${info?.name || card.code}]`,
        type: 'REPOS',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location || CardLocation.MZONE,
        rawPayload: { type: IdleCmdType.REPOS, card }
      })
    }

    for (const card of msg.activatableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `activate-${card.code}-${card.sequence}-${card.desc}`,
        label: `发动 [${info?.name || card.code}]`,
        type: 'ACTIVATE',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location,
        rawPayload: { type: IdleCmdType.ACTIVATE, card }
      })
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
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `attack-${card.code}-${card.sequence}`,
        label: `攻击 [${info?.name || card.code}]`,
        type: 'ATTACK',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location || CardLocation.MZONE,
        rawPayload: { type: BattleCmdType.ATTACK, card }
      })
    }

    for (const card of msg.activatableCards) {
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `activate-bp-${card.code}-${card.sequence}-${card.desc}`,
        label: `发动 [${info?.name || card.code}]`,
        type: 'ACTIVATE',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location,
        rawPayload: { type: BattleCmdType.ACTIVATE, card }
      })
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
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `chain-${card.code}-${card.sequence}-${idx}`,
        label: `发动连锁: [${info?.name || card.code}]`,
        type: 'CHAIN',
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
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `select-card-${card.code}-${idx}`,
        label: `选择 [${info?.name || card.code}]`,
        type: 'SELECT_CARD',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location,
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
      const info = cdbService.getCardById(card.code)
      options.push({
        id: `tribute-${card.code}-${idx}`,
        label: `解放 [${info?.name || card.code}]`,
        type: 'TRIBUTE',
        cardCode: card.code,
        controller: (card.controller ?? player) as 0 | 1,
        sequence: card.sequence,
        location: card.location,
        rawPayload: { index: idx, card }
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
    const cardName = info ? info.name : '卡片'
    options.push({
      id: 'effectyn-yes',
      label: '发动',
      type: 'YES',
      rawPayload: { value: 1 }
    })
    options.push({
      id: 'effectyn-no',
      label: '放弃',
      type: 'NO',
      rawPayload: { value: 0 }
    })
    return {
      kind: 'SELECT_EFFECTYN',
      player,
      title: `是否发动【${cardName}】的效果？`,
      options
    }
  }

  if (msg instanceof YGOProMsgSelectYesNo) {
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
      title: `Player ${player} 提示确认`,
      options
    }
  }

  if (msg instanceof YGOProMsgSelectOption) {
    for (let i = 0; i < msg.options.length; i++) {
      const optCode = msg.options[i]
      options.push({
        id: `opt-${i}`,
        label: `选项 ${i + 1}`,
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
    const attribs: [number, string][] = [
      [0x1, '地'],
      [0x2, '水'],
      [0x4, '炎'],
      [0x8, '风'],
      [0x10, '光'],
      [0x20, '暗'],
      [0x40, '神']
    ]
    for (const [bit, label] of attribs) {
      options.push({
        id: `attrib-${bit}`,
        label,
        type: 'ANNOUNCE',
        rawPayload: { value: bit }
      })
    }
    return {
      kind: 'ANNOUNCE',
      player,
      title: `Player ${player} 宣言属性`,
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
