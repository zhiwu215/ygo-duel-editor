import { YGOProYrp } from 'ygopro-yrp-encode'
import {
  buildDuelFlag,
  buildYrpSingleFile,
  buildYrpTagFile,
  YRP_FLAG_SINGLE_MODE,
  YRP_FLAG_TAG,
  YRP_FLAG_UNIFORM
} from '../../src/main/services/yrpWriter'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

const tagNames = ['Host', 'TagHost', 'TagClient', 'Client']
const tag = new YGOProYrp().fromYrp(
  buildYrpTagFile({
    names: tagNames,
    seed: [100, 200, 300, 400, 500, 600, 700, 800],
    startLp: 8000,
    startHand: 5,
    drawCount: 1,
    opt: buildDuelFlag(5, false, true),
    decks: [
      { main: [1, 2, 3], extra: [4] },
      { main: [5, 6], extra: [] },
      { main: [7], extra: [8, 9] },
      { main: [10, 11], extra: [] }
    ],
    responses: [Uint8Array.from([1, 2, 3]), Uint8Array.from([4])]
  })
)

assert(tag.header !== null, 'tag 回放应有头部')
assert(tag.isTag, 'tag 回放应带 REPLAY_TAG')
assert(!tag.isSingleMode, 'tag 回放应使用四卡组模式')
assert(tag.header!.flag & YRP_FLAG_UNIFORM, 'tag 回放应带 UNIFORM')
assert(tag.header!.flag & YRP_FLAG_TAG, 'tag 回放应带 TAG')
assert(tag.hostName === tagNames[0], `hostName 应为 ${tagNames[0]}，实际 ${tag.hostName}`)
assert(tag.tagHostName === tagNames[1], `tagHostName 应为 ${tagNames[1]}，实际 ${tag.tagHostName}`)
assert(
  tag.tagClientName === tagNames[2],
  `tagClientName 应为 ${tagNames[2]}，实际 ${tag.tagClientName}`
)
assert(tag.clientName === tagNames[3], `clientName 应为 ${tagNames[3]}，实际 ${tag.clientName}`)
assert(tag.hostDeck?.main.length === 3, 'hostDeck 主卡组长度不正确')
assert(tag.tagHostDeck?.main.length === 2, 'tagHostDeck 主卡组长度不正确')
assert(tag.tagClientDeck?.main.length === 1, 'tagClientDeck 主卡组长度不正确')
assert(tag.clientDeck?.main.length === 2, 'clientDeck 主卡组长度不正确')
assert(tag.responses.length === 2, `响应数应为 2，实际 ${tag.responses.length}`)
assert(tag.opt === buildDuelFlag(5, false, true), 'duel_flag 应保留 tag 标记')

const single = new YGOProYrp().fromYrp(
  buildYrpSingleFile({
    names: ['Host', 'Client'],
    seed: [100, 200, 300, 400, 500, 600, 700, 800],
    startLp: 8000,
    startHand: 5,
    drawCount: 1,
    opt: buildDuelFlag(5, false, false),
    scriptFile: './single/single-smoke.lua',
    responses: [Uint8Array.from([5, 6])]
  })
)

assert(!single.isTag, '1v1 回放不应带 tag')
assert(single.isSingleMode, '1v1 回放应保留单机脚本模式')
assert(single.header!.flag & YRP_FLAG_SINGLE_MODE, '1v1 回放应带 SINGLE_MODE')
assert(single.hostName === 'Host' && single.clientName === 'Client', '1v1 名字解析错误')
assert(single.singleScript === 'single-smoke.lua', '1v1 singleScript 解析错误')

let mismatch = false
try {
  buildYrpTagFile({
    names: ['Host', 'Client'],
    seed: [1],
    startLp: 8000,
    startHand: 5,
    drawCount: 1,
    opt: buildDuelFlag(5, false, true),
    decks: [
      { main: [1], extra: [] },
      { main: [2], extra: [] }
    ],
    responses: []
  })
} catch {
  mismatch = true
}
assert(mismatch, '四卡组模式卡组数量不足应拒绝写入')

console.log('[yrp-tag-smoke] tag 四卡组回放与 1v1 单机回放头部、卡组、姓名解析通过')
