import type { DuelActionType, DuelStep, DuelStepTextBlock } from '../types/story'
import { cardNameWrapperPair } from './cardNameWrap'
import { formatStepLogEventLines } from './stepLogText'

export {
  CARD_NAME_WRAPPERS,
  DEFAULT_CARD_NAME_WRAPPER,
  normalizeCardNameWrapper,
  cardNameWrapperPair
} from './cardNameWrap'
export type { CardNameWrapper } from './cardNameWrap'

const NARRATION_ACTIONS = new Set<DuelActionType>([
  'DRAW',
  'DAMAGE',
  'RECOVER',
  'EVENT',
  'CHAIN',
  'RESOLVE_CHAIN',
  'PHASE_CHANGE',
  'TURN_CHANGE',
  'DIALOGUE'
])

const ACTION_LABELS: Partial<Record<DuelActionType, string>> = {
  NORMAL_SUMMON: '通常召唤',
  SPECIAL_SUMMON: '特殊召唤',
  FLIP_SUMMON: '反转召唤',
  XYZ_SUMMON: '超量召唤',
  FUSION_SUMMON: '融合召唤',
  SYNCHRO_SUMMON: '同调召唤',
  LINK_SUMMON: '连接召唤',
  RITUAL_SUMMON: '仪式召唤',
  SET_MONSTER: '盖放',
  SET_SPELL_TRAP: '盖放',
  SET_PENDULUM: '设置灵摆',
  ACTIVATE: '发动',
  ACTIVATE_FIELD: '发动场地',
  ATTACK: '攻击',
  SEARCH: '检索',
  SALVAGE: '回收',
  TO_GRAVE: '送去墓地',
  SEND_TO_GRAVE: '卡组堆墓',
  BANISH: '除外',
  TO_HAND: '加入手牌',
  TO_DECK: '返回卡组',
  CHANGE_POS: '变更表示形式',
  HAND_OPEN: '公开手牌',
  PLACE: '放置',
  DETACH_MATERIAL: '取除素材'
}

export function buildDefaultStepText(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): string | null {
  if (NARRATION_ACTIONS.has(step.actionType)) return null
  const label = ACTION_LABELS[step.actionType]
  const cardName = step.cardName?.trim()
  if (!label || !cardName) return null
  const { open, close } = cardNameWrapperPair(wrapper)
  const card = `${open}${cardName}${close}`
  if (step.actionType === 'ATTACK') {
    const target = step.targetCardName?.trim()
    return target
      ? `${actorName}：我用${card}攻击${open}${target}${close}`
      : `${actorName}：我用${card}攻击`
  }
  return `${actorName}：我${label}${card}`
}

export function buildDefaultTextBlock(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): DuelStepTextBlock | null {
  const text = buildDefaultStepText(step, actorName, wrapper)
  if (!text) return null
  return { id: `default-${step.id}`, text, auto: true }
}

function buildDefaultTextBlocks(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): DuelStepTextBlock[] {
  const blocks: DuelStepTextBlock[] = []
  const summary = buildDefaultTextBlock(step, actorName, wrapper)
  if (summary) blocks.push(summary)
  const lines = formatStepLogEventLines(step, step.logEvents ?? [], wrapper)
  lines.forEach((text, index) => {
    blocks.push({ id: `default-${step.id}-${index}`, text, auto: true })
  })
  return blocks
}

export function displayStepTextBlocks(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): DuelStepTextBlock[] {
  if (step.texts !== undefined) return step.texts
  return buildDefaultTextBlocks(step, actorName, wrapper)
}

export function refreshAutoTextBlock(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): DuelStepTextBlock[] | undefined {
  if (step.texts === undefined) return undefined
  if (!step.texts.some((block) => block.auto)) return step.texts
  const userBlocks = step.texts.filter((block) => !block.auto)
  const autoBlocks = buildDefaultTextBlocks(step, actorName, wrapper).filter(
    (block) => !userBlocks.some((userBlock) => userBlock.id === block.id)
  )
  return [...autoBlocks, ...userBlocks]
}
