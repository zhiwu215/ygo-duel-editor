import { Answer, CardPosition } from '@shared/index'
import type { CardEngineActions } from './engineActions'

export type CardEngineActionKey = 'summon' | 'spSummon' | 'set' | 'repos' | 'attack' | 'chain'

export interface CardEngineActionSpec {
  label: string
  answer: Answer
}

export interface CardEngineActionMap {
  summon?: CardEngineActionSpec
  spSummon?: CardEngineActionSpec
  set?: CardEngineActionSpec
  repos?: CardEngineActionSpec
  attack?: CardEngineActionSpec
  chain?: CardEngineActionSpec
  activate: CardEngineActionSpec[]
}

export function reposActionLabel(position: number | undefined): string {
  return position === CardPosition.FACEDOWN_DEFENSE
    ? '反转召唤'
    : position === CardPosition.FACEUP_ATTACK
      ? '转为守备'
      : '转为攻击'
}

export function buildCardEngineActionMap(
  actions: CardEngineActions,
  position: number | undefined
): CardEngineActionMap {
  const map: CardEngineActionMap = { activate: [] }

  if (actions.summon) {
    map.summon = { label: '召唤', answer: { kind: 'idle', cmd: 'SUMMON', card: actions.summon } }
  }
  if (actions.spSummon) {
    map.spSummon = {
      label: '特殊召唤',
      answer: { kind: 'idle', cmd: 'SPSUMMON', card: actions.spSummon }
    }
  }
  const setCard = actions.sset ?? actions.mset
  if (setCard) {
    map.set = {
      label: '盖放',
      answer: { kind: 'idle', cmd: actions.sset ? 'SSET' : 'MSET', card: setCard }
    }
  }
  map.activate = actions.activate.map((cardReq, index) => ({
    label: actions.activate.length > 1 ? `发动（效果 ${index + 1}）` : '发动',
    answer:
      actions.requestKind === 'battle'
        ? { kind: 'battle', cmd: 'ACTIVATE', card: cardReq }
        : { kind: 'idle', cmd: 'ACTIVATE', card: cardReq }
  }))
  if (actions.repos) {
    map.repos = {
      label: reposActionLabel(position),
      answer: { kind: 'idle', cmd: 'REPOS', card: actions.repos }
    }
  }
  if (actions.attack) {
    map.attack = { label: '攻击', answer: { kind: 'battle', cmd: 'ATTACK', card: actions.attack } }
  }
  if (actions.chain) {
    map.chain = { label: '发动', answer: { kind: 'chain', card: actions.chain } }
  }

  return map
}
