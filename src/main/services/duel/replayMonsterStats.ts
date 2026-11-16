import type { OcgcoreDuel } from 'koishipro-core.js'
import {
  OcgcoreCommonConstants,
  YGOProMsgChainEnd,
  YGOProMsgChainSolved,
  YGOProMsgNewPhase,
  YGOProMsgUpdateData
} from 'ygopro-msg-encode'
import { CardLocation } from '@shared/index'

export function recordMonsterStats(
  duel: OcgcoreDuel,
  message: unknown,
  stream: Uint8Array[]
): void {
  if (!(
    message instanceof YGOProMsgChainEnd ||
    message instanceof YGOProMsgChainSolved ||
    message instanceof YGOProMsgNewPhase
  ))
    return
  const { QUERY_ATTACK, QUERY_DEFENSE, QUERY_POSITION } = OcgcoreCommonConstants
  for (const player of [0, 1]) {
    const update = new YGOProMsgUpdateData()
    update.player = player
    update.location = CardLocation.MZONE
    update.cards = duel.queryFieldCard({
      player,
      location: CardLocation.MZONE,
      queryFlag: QUERY_POSITION | QUERY_ATTACK | QUERY_DEFENSE,
      useCache: 0
    }).cards
    stream.push(update.toPayload())
  }
}
