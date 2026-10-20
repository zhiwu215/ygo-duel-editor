import {
  ACTION_TYPE_NAMES,
  DuelStep,
  DuelPhase,
  DuelActionType,
  PHASE_SHORT_NAMES,
  CardLocation
} from '@shared/index'
import { stepCardName } from '../../utils/cardNames'
import type { StepGroupKind } from './StepGroupHeader'

export const ALL_PHASES: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']

export const ALL_ACTIONS: DuelActionType[] = [
  'NORMAL_SUMMON',
  'SPECIAL_SUMMON',
  'ACTIVATE',
  'SET_SPELL_TRAP',
  'SET_MONSTER',
  'DRAW',
  'ATTACK',
  'TO_GRAVE',
  'BANISH',
  'TO_HAND',
  'CHANGE_POS',
  'DAMAGE',
  'EVENT',
  'CHAIN',
  'DIALOGUE'
]

export const COMMONLY_USED_LOCATIONS: { loc: number; name: string }[] = [
  { loc: CardLocation.HAND, name: '手牌' },
  { loc: CardLocation.MZONE, name: '怪兽区' },
  { loc: CardLocation.SZONE, name: '魔陷区' },
  { loc: CardLocation.GRAVE, name: '墓地' },
  { loc: CardLocation.DECK, name: '主卡组' },
  { loc: CardLocation.EXTRA, name: '额外卡组' },
  { loc: CardLocation.REMOVED, name: '除外区' },
  { loc: CardLocation.FZONE, name: '场地魔法区' },
  { loc: CardLocation.PZONE, name: '灵摆区' }
]

export function getLocationDisplayName(loc?: number, seq?: number): string {
  if (loc === undefined) return ''
  if (loc === CardLocation.MZONE && (seq === 5 || seq === 6)) {
    return `EX怪兽区${seq === 5 ? '1' : '2'}`
  }
  const match = COMMONLY_USED_LOCATIONS.find((l) => l.loc === loc)
  if (match) return match.name
  return '未知区域'
}

function getDamageValue(damage: DuelStep): number | null {
  if (damage.lpChange) return damage.lpChange.newLp - damage.lpChange.oldLp
  const description = damage.description?.trim()
  if (!description) return null

  const lpPair = description.match(/LP[^\d]*(-?\d+)\s*(?:→|->|=>)\s*(-?\d+)/i)
  if (lpPair) return Number(lpPair[2]) - Number(lpPair[1])

  const explicit = description.match(/(-?\d+)\s*(?:点|LP|生命值?|伤害)/i)
  if (explicit) return -Math.abs(Number(explicit[1]))

  const nearby = description.match(/(?:受到|造成|扣(?:除|减)?|损失|伤害)[^\d-]{0,8}(-?\d+)/)
  if (nearby) return -Math.abs(Number(nearby[1]))

  const fallback = description.match(/-?\d+/)
  return fallback ? -Math.abs(Number(fallback[0])) : null
}

export function getAttackDamageText(attack: DuelStep, damage?: DuelStep): string | undefined {
  if (!damage) return undefined
  const value = getDamageValue(damage)
  if (value === null || value === 0) return undefined
  const targetPlayer = damage.lpChange?.player ?? (attack.actionPlayer === 0 ? 1 : 0)
  const targetName = targetPlayer === 0 ? '我方' : '对方'
  return value < 0 ? `${targetName}受到 -${Math.abs(value)}` : `${targetName}回复 +${value}`
}

export function duelActionLabel(step: Pick<DuelStep, 'actionType' | 'targetPlayer'>): string {
  if (step.actionType === 'ATTACK' && step.targetPlayer !== undefined) return '直接攻击'
  return ACTION_TYPE_NAMES[step.actionType] || step.actionType
}

export const resolveStepCardName = (step: DuelStep): string => stepCardName(step) || '剧情事件'

export function isFirstInTurn(steps: DuelStep[], idx: number): boolean {
  return idx === 0 || steps[idx - 1].turn !== steps[idx].turn
}

export function isFirstInPhase(steps: DuelStep[], idx: number): boolean {
  return (
    isFirstInTurn(steps, idx) ||
    steps[idx - 1].phase !== steps[idx].phase ||
    steps[idx - 1].turn !== steps[idx].turn
  )
}

export interface StepEntry {
  step: DuelStep
  index: number
}

export interface StepGroup {
  kind: 'single' | StepGroupKind
  key: string
  entries: StepEntry[]
}

export type StepListItem =
  | { kind: 'separator'; key: string; label: string; turnPlayer: 0 | 1 }
  | { kind: 'group'; group: StepGroup }

export function buildGroups(entries: StepEntry[]): StepGroup[] {
  const groups: StepGroup[] = []
  let cursor = 0

  while (cursor < entries.length) {
    const current = entries[cursor]

    if ((current.step.chainIndex ?? 0) > 0) {
      let end = cursor + 1
      while (
        end < entries.length &&
        (entries[end].step.chainIndex ?? 0) > (entries[end - 1].step.chainIndex ?? 0)
      ) {
        end++
      }
      groups.push({
        kind: 'chain',
        key: current.step.id,
        entries: entries.slice(cursor, end)
      })
      cursor = end
      continue
    }

    const next = entries[cursor + 1]
    if (current.step.actionType === 'ATTACK' && next?.step.actionType === 'DAMAGE') {
      groups.push({
        kind: 'attack',
        key: current.step.id,
        entries: entries.slice(cursor, cursor + 2)
      })
      cursor += 2
      continue
    }

    groups.push({ kind: 'single', key: current.step.id, entries: [current] })
    cursor++
  }

  return groups
}

export function buildStepList(steps: DuelStep[]): StepListItem[] {
  const items: StepListItem[] = []
  let pending: StepEntry[] = []
  let lastGroupKey = ''

  const pushSeparator = (step: DuelStep, index: number): void => {
    const groupKey = `${step.turn}|${step.turnPlayer}|${step.phase}`
    if (groupKey === lastGroupKey) return
    lastGroupKey = groupKey
    const playerName = step.turnPlayer === 0 ? '我方' : '对方'
    items.push({
      kind: 'separator',
      key: `separator_${index}_${groupKey}`,
      label: `第 ${step.turn} 回合 ${playerName} · ${PHASE_SHORT_NAMES[step.phase] || step.phase}`,
      turnPlayer: step.turnPlayer
    })
  }

  const flush = (): void => {
    if (pending.length === 0) return
    const first = pending[0]
    pushSeparator(first.step, first.index)
    buildGroups(pending).forEach((group) => items.push({ kind: 'group', group }))
    pending = []
  }

  steps.forEach((step, index) => {
    if (step.actionType === 'PHASE_CHANGE' || step.actionType === 'TURN_CHANGE') {
      flush()
      pushSeparator(step, index)
      return
    }
    if (
      index === 0 ||
      isFirstInPhase(steps, index) ||
      steps[index - 1].turnPlayer !== step.turnPlayer
    ) {
      flush()
    }
    pending.push({ step, index })
  })

  flush()

  return items
}
