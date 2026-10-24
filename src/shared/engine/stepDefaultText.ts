import type { DuelActionType, DuelStep, DuelStepTextBlock } from '../types/story'

export const CARD_NAME_WRAPPERS = ['「」', '『』', '[]', '【】'] as const

export type CardNameWrapper = (typeof CARD_NAME_WRAPPERS)[number]

export const DEFAULT_CARD_NAME_WRAPPER: CardNameWrapper = '「」'

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
  PLACE: '放置',
  DETACH_MATERIAL: '取除素材'
}

export function normalizeCardNameWrapper(value: string | undefined): CardNameWrapper {
  return CARD_NAME_WRAPPERS.includes(value as CardNameWrapper)
    ? (value as CardNameWrapper)
    : DEFAULT_CARD_NAME_WRAPPER
}

export function cardNameWrapperPair(value: string | undefined): { open: string; close: string } {
  const normalized = normalizeCardNameWrapper(value)
  return { open: normalized[0], close: normalized[1] }
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

export function displayStepTextBlocks(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): DuelStepTextBlock[] {
  if (step.texts !== undefined) return step.texts
  const block = buildDefaultTextBlock(step, actorName, wrapper)
  return block ? [block] : []
}

export function refreshAutoTextBlock(
  step: DuelStep,
  actorName: string,
  wrapper: string | undefined
): DuelStepTextBlock[] | undefined {
  if (step.texts === undefined) return undefined
  const autoBlock = step.texts.find((block) => block.auto)
  if (!autoBlock) return step.texts
  const next = buildDefaultTextBlock(step, actorName, wrapper)
  if (!next) return step.texts.filter((block) => block.id !== autoBlock.id)
  return step.texts.map((block) =>
    block.id === autoBlock.id ? { ...block, text: next.text } : block
  )
}
