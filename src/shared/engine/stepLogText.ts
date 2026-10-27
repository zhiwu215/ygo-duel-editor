import { resolveCounterName } from '../constants/counters'
import { POSITION_NAMES } from '../constants/positions'
import type { DuelLogCardRef, DuelLogEvent, DuelSummonKind } from '../types/duelLog'
import type { DuelStep } from '../types/story'
import { cardNameWrapperPair } from './cardNameWrap'

const SUMMON_LABELS: Record<DuelSummonKind, string> = {
  normal: '通常召唤',
  special: '特殊召唤',
  flip: '反转召唤',
  fusion: '融合召唤',
  synchro: '同调召唤',
  xyz: '超量召唤',
  link: '连接召唤',
  ritual: '仪式召唤',
  pendulum: '灵摆召唤'
}

function sideName(player: 0 | 1): string {
  return player === 0 ? '我方' : '对方'
}

function cardName(card: DuelLogCardRef, wrapper: string | undefined): string {
  if (!card.name) return '卡片'
  const { open, close } = cardNameWrapperPair(wrapper)
  return `${open}${card.name}${close}`
}

export function summaryEventIndex(step: DuelStep, events: DuelLogEvent[]): number {
  if (step.actionType === 'DRAW') {
    const drawIndex = events.findIndex((e) => e.kind === 'draw')
    if (drawIndex >= 0) return drawIndex
  }
  const cardCode = step.cardCode
  if (!cardCode) return -1
  const matches = (card: DuelLogCardRef): boolean => card.code === cardCode
  for (let index = 0; index < events.length; index++) {
    const event = events[index]
    if (event.kind === 'summon' && matches(event.card)) return index
    if (event.kind === 'set' && matches(event.card)) return index
    if (event.kind === 'activate' && matches(event.card)) return index
    if (event.kind === 'attack' && matches(event.attacker)) return index
    if (event.kind === 'move' && matches(event.move.card)) return index
  }
  return -1
}

function eventLines(event: DuelLogEvent, wrapper: string | undefined): string[] {
  if (event.kind === 'summon') {
    return [`${SUMMON_LABELS[event.summonKind] ?? '特殊召唤'} ${cardName(event.card, wrapper)}`]
  }
  if (event.kind === 'set') return [`盖放 ${cardName(event.card, wrapper)}`]
  if (event.kind === 'activate') {
    const lines = [`发动 ${cardName(event.card, wrapper)}`]
    if (event.effectText) lines.push(event.effectText)
    return lines
  }
  if (event.kind === 'chain') return [`连锁 ${event.chainCount}`]
  if (event.kind === 'chain-solving') return []
  if (event.kind === 'chain-end') return []
  if (event.kind === 'chain-negated') {
    const action = event.disabled ? '效果无效' : '发动无效'
    return [`${action}${event.card ? ` · ${cardName(event.card, wrapper)}` : ''}`]
  }
  if (event.kind === 'move') {
    const move = event.move
    return [`${move.reasonText} ${cardName(move.card, wrapper)}`]
  }
  if (event.kind === 'target') {
    return [`对象：${event.cards.map((card) => cardName(card, wrapper)).join('、')}`]
  }
  if (event.kind === 'attack') {
    return [
      `攻击 ${cardName(event.attacker, wrapper)} → ${event.defender ? cardName(event.defender, wrapper) : '直接攻击'}`
    ]
  }
  if (event.kind === 'attack-disabled') {
    return [`攻击被无效${event.card ? ` · ${cardName(event.card, wrapper)}` : ''}`]
  }
  if (event.kind === 'draw') {
    const { open, close } = cardNameWrapperPair(wrapper)
    const names = event.cards.map((card) => (card.name ? `${open}${card.name}${close}` : '卡片'))
    return [
      `${sideName(event.player)}抽卡 ×${event.cards.length || 1}${names.length > 0 ? `：${names.join('、')}` : ''}`
    ]
  }
  if (event.kind === 'damage') {
    return [`${sideName(event.player)}受到 -${event.value} LP → ${event.lp}`]
  }
  if (event.kind === 'recover') {
    return [`${sideName(event.player)}回复 +${event.value} LP → ${event.lp}`]
  }
  if (event.kind === 'lp-update') {
    return [`${sideName(event.player)} LP → ${event.lp}`]
  }
  if (event.kind === 'position') {
    return [
      `${cardName(event.card, wrapper)} ${POSITION_NAMES[event.fromPosition] ?? '？'} → ${POSITION_NAMES[event.toPosition] ?? '？'}`
    ]
  }
  if (event.kind === 'counter') {
    return [
      `${event.remove ? '取除' : '放置'} ${resolveCounterName(event.counterType)} ×${event.count} · ${cardName(event.card, wrapper)}`
    ]
  }
  if (event.kind === 'reveal') {
    const source = event.source === 'hand' ? '手牌' : event.source === 'field' ? '盖卡' : '卡组'
    return [`公开${source} ${event.cards.map((card) => cardName(card, wrapper)).join('、')}`]
  }
  if (event.kind === 'swap') {
    return [`交换 ${cardName(event.from, wrapper)} ↔ ${cardName(event.to, wrapper)}`]
  }
  if (event.kind === 'text') return [event.text]
  return []
}

export function formatStepLogEventLines(
  step: DuelStep,
  events: DuelLogEvent[],
  wrapper?: string
): string[] {
  const summaryIndex = summaryEventIndex(step, events)
  const lines: string[] = []
  events.forEach((event, index) => {
    if (index === summaryIndex) return
    if (event.kind === 'turn-start' || event.kind === 'phase') return
    if (event.kind === 'chain' && step.chainIndex === event.chainCount) return
    lines.push(...eventLines(event, wrapper))
  })
  return lines
}
