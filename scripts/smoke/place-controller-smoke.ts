import assert from 'node:assert/strict'
import { YGOProMsgSelectDisField, YGOProMsgSelectPlace } from 'ygopro-msg-encode'
import { CardLocation } from '@shared/index'
import { routeRequest } from '../../src/main/services/duel/request-router'
import { encodeAnswer } from '../../src/main/services/duel/answer-encoder'

let cases = 0
for (const Message of [YGOProMsgSelectPlace, YGOProMsgSelectDisField]) {
  for (const player of [0, 1] as const) {
    for (const controller of [0, 1] as const) {
      for (const location of [CardLocation.MZONE, CardLocation.SZONE]) {
        const sequences = [0, 1, 3]
        const offset = (controller === player ? 0 : 16) + (location === CardLocation.MZONE ? 0 : 8)
        const msg = new Message()
        msg.player = player
        msg.count = 1
        msg.flag = ~sequences.reduce((mask, sequence) => mask | (1 << (offset + sequence)), 0) >>> 0
        const request = routeRequest(msg, { id: 'place-controller', seq: cases })
        assert(request?.data.kind === 'place' || request?.data.kind === 'disfield')
        assert.equal(request.player, player)
        assert.deepEqual(
          request.data.places,
          sequences.map((sequence) => ({ controller, location, sequence })),
          `${Message.name}: selecting player ${player}, destination ${controller}, location ${location}`
        )
        for (const place of request.data.places) {
          assert.deepEqual(
            [...encodeAnswer(msg, { kind: 'place', places: [place] })],
            [controller, location, place.sequence]
          )
        }
        cases++
      }
    }
  }
}
console.log(`PASS: ${cases} place controller cases`)
