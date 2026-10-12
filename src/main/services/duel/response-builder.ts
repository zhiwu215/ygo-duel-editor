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
  YGOProMsgAnnounceCard,
  IndexResponse
} from 'ygopro-msg-encode'
import { _OcgcoreConstants } from 'koishipro-core.js'
import { EngineActionOption } from '@shared/index'
import { cdbService } from '../../db/cdbService'

const { OcgcoreScriptConstants } = _OcgcoreConstants

export function buildResponseForOption(
  msg: unknown,
  option: EngineActionOption,
  payload?: unknown
): {
  response: Uint8Array
  logText: string
} {
  if (msg instanceof YGOProMsgSelectIdleCmd) {
    const { type, card } = option.rawPayload
    const cardName = card ? cdbService.getCardById(card.code)?.name || card.code : ''

    let logText = `Player ${msg.player}: `
    if (type === IdleCmdType.SUMMON) logText += `通常召唤 [${cardName}]`
    else if (type === IdleCmdType.SPSUMMON) logText += `特殊召唤 [${cardName}]`
    else if (type === IdleCmdType.SSET) logText += `盖放 [${cardName}]`
    else if (type === IdleCmdType.MSET) logText += `里侧盖放怪兽 [${cardName}]`
    else if (type === IdleCmdType.ACTIVATE) logText += `发动 [${cardName}]`
    else if (type === IdleCmdType.REPOS) logText += `变更表示形式 [${cardName}]`
    else if (type === IdleCmdType.TO_BP) logText += '进入战斗阶段'
    else if (type === IdleCmdType.TO_EP) logText += '结束回合'

    const response = msg.prepareResponse(type, card)
    return { response, logText }
  }

  if (msg instanceof YGOProMsgSelectBattleCmd) {
    const { type, card } = option.rawPayload
    const cardName = card ? cdbService.getCardById(card.code)?.name || card.code : ''

    let logText = `Player ${msg.player}: `
    if (type === BattleCmdType.ATTACK) logText += `怪兽攻击宣言 [${cardName}]`
    else if (type === BattleCmdType.ACTIVATE) logText += `发动 [${cardName}]`
    else if (type === BattleCmdType.TO_M2) logText += '进入主要阶段2'
    else if (type === BattleCmdType.TO_EP) logText += '结束战斗回合'

    const response = msg.prepareResponse(type, card)
    return { response, logText }
  }

  if (msg instanceof YGOProMsgSelectPlace || msg instanceof YGOProMsgSelectDisField) {
    const place = option.rawPayload.place
    const response = msg.prepareResponse([place])
    const locName = place.location === OcgcoreScriptConstants.LOCATION_MZONE ? '怪兽区' : '魔陷区'
    return {
      response,
      logText: `放置在 ${place.player === msg.player ? '我方' : '对方'} ${locName} 第 ${place.sequence + 1} 格`
    }
  }

  if (msg instanceof YGOProMsgSelectChain) {
    if (option.rawPayload.pass) {
      return {
        response: msg.prepareResponse(null),
        logText: '放弃发动连锁'
      }
    }
    return {
      response: msg.prepareResponse(IndexResponse(option.rawPayload.chainIndex)),
      logText: `发动连锁: ${option.label}`
    }
  }

  if (msg instanceof YGOProMsgSelectCard) {
    if (option.rawPayload?.cancel) {
      return {
        response: msg.prepareResponse(null),
        logText: '取消选择'
      }
    }
    const indicesPayload = (payload as { indices?: number[] } | undefined)?.indices
    const selected = indicesPayload ?? [option.rawPayload.index]
    const cardOptions = selected.map((idx: number) => IndexResponse(idx))
    return {
      response: msg.prepareResponse(cardOptions),
      logText: `选择 ${selected.length} 张卡`
    }
  }

  if (msg instanceof YGOProMsgSelectTribute) {
    if (option.rawPayload?.cancel) {
      return {
        response: msg.prepareResponse(null),
        logText: '取消解放'
      }
    }
    const indicesPayload = (payload as { indices?: number[] } | undefined)?.indices
    const selected = indicesPayload ?? [option.rawPayload.index]
    const cardOptions = selected.map((idx: number) => IndexResponse(idx))
    return {
      response: msg.prepareResponse(cardOptions),
      logText: `解放 ${selected.length} 只怪兽`
    }
  }

  if (msg instanceof YGOProMsgSelectPosition) {
    return {
      response: msg.prepareResponse(option.rawPayload.position),
      logText: `选择表示形式: ${option.label}`
    }
  }

  if (msg instanceof YGOProMsgSelectEffectYn) {
    return {
      response: msg.prepareResponse(Boolean(option.rawPayload.value)),
      logText: option.rawPayload.value ? '发动效果' : '放弃发动'
    }
  }

  if (msg instanceof YGOProMsgSelectYesNo) {
    return {
      response: msg.prepareResponse(Boolean(option.rawPayload.value)),
      logText: option.rawPayload.value ? '选择: 是' : '选择: 否'
    }
  }

  if (msg instanceof YGOProMsgSelectOption) {
    return {
      response: msg.prepareResponse(IndexResponse(option.rawPayload.index)),
      logText: `选择选项 ${option.rawPayload.index + 1}`
    }
  }

  if (msg instanceof YGOProMsgAnnounceAttrib) {
    return {
      response: msg.prepareResponse(option.rawPayload.value),
      logText: `宣言属性: ${option.label}`
    }
  }

  if (msg instanceof YGOProMsgAnnounceRace) {
    return {
      response: msg.prepareResponse(option.rawPayload.value),
      logText: `宣言种族: ${option.label}`
    }
  }

  if (msg instanceof YGOProMsgAnnounceNumber) {
    return {
      response: msg.prepareResponse(option.rawPayload.value),
      logText: `宣言数字: ${option.rawPayload.value}`
    }
  }

  if (msg instanceof YGOProMsgAnnounceCard) {
    const cardCode = Number(
      (payload as { cardCode?: number } | undefined)?.cardCode ?? option.rawPayload.value ?? 0
    )
    if (!cardCode) {
      throw new Error('宣言卡片需要先指定卡名 (cardCode)。')
    }
    const cardName = cdbService.getCardById(cardCode)?.name || String(cardCode)
    return {
      response: msg.prepareResponse(cardCode),
      logText: `宣言卡片: ${cardName}`
    }
  }

  const msgName = (msg as { constructor?: { name?: string } }).constructor?.name ?? 'unknown'
  throw new Error(`不支持的引擎询问类型: ${msgName}`)
}
