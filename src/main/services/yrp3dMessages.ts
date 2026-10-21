import {
  YGOProMsgBase,
  YGOProMsgReloadField,
  YGOProMsgStart,
  YGOProMessages
} from 'ygopro-msg-encode'

class RawGameMessage extends YGOProMsgBase {
  private readonly bytes: Uint8Array

  public constructor(bytes: Uint8Array) {
    super()
    this.bytes = bytes
  }

  public toPayload(): Uint8Array {
    return this.bytes
  }
}

function findReloadField(payloads: Uint8Array[]): YGOProMsgReloadField | null {
  for (const payload of payloads) {
    const message = YGOProMessages.getInstanceFromPayload(payload)
    if (message instanceof YGOProMsgReloadField) return message
  }
  return null
}

function buildStartMessage(reload: YGOProMsgReloadField): YGOProMsgStart {
  const [player0, player1] = reload.players
  const start = new YGOProMsgStart()
  start.playerType = 0
  start.duelRule = reload.duelRule
  start.startLp0 = player0.lp
  start.startLp1 = player1.lp
  start.player0 = { deckCount: player0.deckCount, extraCount: player0.extraCount }
  start.player1 = { deckCount: player1.deckCount, extraCount: player1.extraCount }
  return start
}

export function buildYrp3dMessages(payloads: Uint8Array[]): YGOProMsgBase[] {
  const messages: YGOProMsgBase[] = []
  const hasStart = payloads.some((payload) => payload[0] === YGOProMsgStart.identifier)
  if (!hasStart) {
    const reload = findReloadField(payloads)
    if (reload) messages.push(buildStartMessage(reload))
  }
  for (const payload of payloads) messages.push(new RawGameMessage(payload))
  return messages
}
