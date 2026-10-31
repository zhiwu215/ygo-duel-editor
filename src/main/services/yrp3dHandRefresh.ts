import {
  CardQuery,
  OcgcoreCommonConstants,
  YGOProMessages,
  YGOProMsgShuffleHand,
  YGOProMsgUpdateData
} from 'ygopro-msg-encode'
import { CardLocation, CardPosition } from '@shared/index'

const { QUERY_CODE, QUERY_POSITION } = OcgcoreCommonConstants
const HAND_PLAYERS = new Set([0, 1])

function handRefreshPayloadOf(shuffle: YGOProMsgShuffleHand): Uint8Array | null {
  const codes = shuffle.cards.map((code) => code & 0x7fffffff)
  if (codes.every((code) => code === 0)) return null

  const update = new YGOProMsgUpdateData()
  update.player = shuffle.player
  update.location = CardLocation.HAND
  update.cards = codes.map((code, sequence) => {
    const query = new CardQuery()
    query.flags = QUERY_CODE | QUERY_POSITION
    query.code = code
    query.controller = shuffle.player
    query.location = CardLocation.HAND
    query.sequence = sequence
    query.position = CardPosition.FACEDOWN
    return query
  })
  return update.toPayload()
}

export function insertYrp3dHandRefresh(payloads: Uint8Array[], viewer: number): Uint8Array[] {
  if (!HAND_PLAYERS.has(viewer)) return payloads

  const out: Uint8Array[] = []
  for (const payload of payloads) {
    out.push(payload)
    let message: unknown
    try {
      message = YGOProMessages.getInstanceFromPayload(payload)
    } catch {
      continue
    }
    if (!(message instanceof YGOProMsgShuffleHand)) continue
    if (message.player !== viewer) continue
    const refresh = handRefreshPayloadOf(message)
    if (refresh) out.push(refresh)
  }
  return out
}
