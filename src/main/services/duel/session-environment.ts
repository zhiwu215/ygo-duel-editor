import { createHash } from 'node:crypto'
import type { OcgcoreWrapper } from 'koishipro-core.js'
import { version } from '../../../../node_modules/koishipro-core.js/package.json'
import type { EngineDuelInitParams, SessionEnvironment } from '@shared/index'

export function openingCardCodes(params: EngineDuelInitParams): number[] {
  const codes = params.puzzleState
    ? params.puzzleState.cards.flatMap((card) => [card.code, ...(card.overlayMaterials ?? [])])
    : [
        ...(params.p0Deck ?? []),
        ...(params.p1Deck ?? []),
        ...(params.p0Extra ?? []),
        ...(params.p1Extra ?? [])
      ]
  return [...new Set(codes.filter((code) => code > 0))].sort((a, b) => a - b)
}

export function readSessionEnvironment(
  wrapper: OcgcoreWrapper,
  cardCodes: number[]
): SessionEnvironment {
  const cards = createHash('sha256')
  const scripts = createHash('sha256')
  const paths = new Set([
    'constant.lua',
    'utility.lua',
    'special.lua',
    'init.lua',
    'patches/entry.lua'
  ])
  for (const code of cardCodes) {
    const card = wrapper.readCard(code)
    cards.update(
      JSON.stringify([code, card], (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    )
    paths.add('c' + code + '.lua')
    if (card?.alias) paths.add('c' + card.alias + '.lua')
  }
  for (const path of paths) {
    const bytes = wrapper.readScript('./script/' + path)
    scripts.update(JSON.stringify([path, bytes?.byteLength ?? -1]))
    if (bytes) scripts.update(bytes)
  }
  return {
    engineVersion: version,
    cardCodes,
    cardHash: cards.digest('hex'),
    scriptHash: scripts.digest('hex')
  }
}

export function sessionEnvironmentWarning(
  saved: SessionEnvironment | undefined,
  current: SessionEnvironment
): string | undefined {
  if (!saved) return undefined
  const changes = [
    saved.engineVersion !== current.engineVersion &&
      '引擎 ' + saved.engineVersion + ' → ' + current.engineVersion,
    saved.cardHash !== current.cardHash && '开局卡片数据',
    saved.scriptHash !== current.scriptHash && '开局卡片或公共脚本'
  ].filter(Boolean)
  return changes.length ? '与存档相比，运行环境有变化：' + changes.join('、') : undefined
}
