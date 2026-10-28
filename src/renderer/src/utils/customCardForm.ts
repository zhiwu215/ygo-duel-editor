import {
  CardType,
  CustomCard,
  CustomCardInput,
  linkMarkerCount,
  normalizeCardStrings
} from '@shared/index'
import type { CustomCardScriptGenerateResult } from '@shared/index'
import { getCardKind, hasEffect, hasLink, hasPendulum, normalizeCardType } from './customCardType'

const STAT_UNKNOWN = -2

export interface CustomCardEditorForm {
  id: string
  name: string
  desc: string
  type: number
  attribute: number
  race: number
  level: string
  scaleLeft: string
  scaleRight: string
  atk: string
  def: string
  markers: number
  alias: string
  setcode: string[]
  strings: string[]
  category: number
}

export interface CustomCardValidation {
  errors: string[]
  warnings: string[]
}

const EMPTY_FORM: CustomCardEditorForm = {
  id: '',
  name: '',
  desc: '',
  type: CardType.MONSTER | CardType.EFFECT,
  attribute: 1,
  race: 1,
  level: '4',
  scaleLeft: '0',
  scaleRight: '0',
  atk: '1000',
  def: '1000',
  markers: 0,
  alias: '0',
  setcode: ['', '', '', ''],
  strings: Array.from({ length: 16 }, () => ''),
  category: 0
}

function formatSetcodeSlot(value: number): string {
  return value === 0 ? '' : value.toString(16).padStart(4, '0').toUpperCase()
}

function formatStat(value: number): string {
  return value === STAT_UNKNOWN ? '' : String(value)
}

export function formatSetcodeInput(value: string): string {
  return value
    .replace(/^0x/i, '')
    .replace(/[^0-9a-f]/gi, '')
    .slice(0, 4)
    .toUpperCase()
}

export function parseSetcodeInput(value: string): number {
  const text = formatSetcodeInput(value)
  if (!text) return 0
  return parseInt(text, 16) || 0
}

export function formatScriptSize(size: number | undefined): string {
  if (!size || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

export function parseStat(value: string): number {
  const text = value.trim()
  if (!text || text === '?' || text === '？') return STAT_UNKNOWN
  const numeric = Number(text)
  if (!Number.isFinite(numeric)) return STAT_UNKNOWN
  return Math.trunc(numeric)
}

export function parseCount(value: string, min: number, max: number, fallback = 0): number {
  const numeric = Number(value.trim())
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

export function parseAlias(value: string): number {
  const numeric = Number(value.trim())
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(0x7fffffff, Math.trunc(numeric)))
}

export function formFromCard(
  card: CustomCard | undefined,
  prefillName: string
): CustomCardEditorForm {
  if (!card) {
    return {
      ...EMPTY_FORM,
      name: prefillName,
      setcode: [...EMPTY_FORM.setcode],
      strings: [...EMPTY_FORM.strings]
    }
  }
  const isLink = hasLink(card.type)
  return {
    id: String(card.id),
    name: card.name,
    desc: card.desc,
    type: normalizeCardType(card.type),
    attribute: card.attribute,
    race: card.race,
    level: String(card.level),
    scaleLeft: String(card.lscale),
    scaleRight: String(card.rscale),
    atk: formatStat(card.atk),
    def: isLink ? '' : formatStat(card.def),
    markers: card.linkMarkers,
    alias: String(card.alias),
    setcode: Array.from({ length: 4 }, (_, index) => formatSetcodeSlot(card.setcode[index] ?? 0)),
    strings: normalizeCardStrings(card.strings),
    category: card.category
  }
}

export function buildCustomCardInput(
  editingId: number | null,
  form: CustomCardEditorForm,
  imageSourcePath?: string,
  scriptSourcePath?: string
): CustomCardInput {
  const type = normalizeCardType(form.type)
  const kind = getCardKind(type)
  const isMonster = kind === 'monster'
  const isLink = isMonster && hasLink(type)
  const isPendulum = isMonster && hasPendulum(type)
  const requestedId = form.id.trim() ? Number(form.id.trim()) : undefined

  return {
    id: editingId ?? requestedId,
    editingId: editingId ?? undefined,
    name: form.name.trim(),
    desc: form.desc.trim(),
    type,
    attribute: isMonster ? form.attribute : 0,
    race: isMonster ? form.race : 0,
    level: isMonster ? parseCount(form.level, 0, 13) : 0,
    lscale: isPendulum ? parseCount(form.scaleLeft, 0, 13) : 0,
    rscale: isPendulum ? parseCount(form.scaleRight, 0, 13) : 0,
    atk: isMonster ? parseStat(form.atk) : 0,
    def: isMonster && !isLink ? parseStat(form.def) : 0,
    linkMarkers: isLink ? form.markers : 0,
    alias: parseAlias(form.alias),
    ot: 0,
    setcode: Array.from({ length: 4 }, (_, index) => parseSetcodeInput(form.setcode[index] ?? '')),
    category: form.category,
    strings: normalizeCardStrings(form.strings),
    imageSourcePath,
    scriptSourcePath
  }
}

export function buildCustomCardDraft(
  editingId: number | null,
  form: CustomCardEditorForm
): CustomCard {
  const input = buildCustomCardInput(editingId, form)
  return {
    schemaVersion: 2,
    id: input.id ?? 0,
    alias: input.alias,
    ot: input.ot,
    setcode: input.setcode,
    type: input.type,
    attribute: input.attribute,
    race: input.race,
    level: input.level,
    lscale: input.lscale,
    rscale: input.rscale,
    atk: input.atk,
    def: input.def,
    linkMarkers: input.linkMarkers,
    category: input.category,
    name: input.name,
    desc: input.desc,
    strings: input.strings,
    createdAt: 0,
    updatedAt: 0
  }
}

export function formWithAiScriptResult(
  form: CustomCardEditorForm,
  result: CustomCardScriptGenerateResult
): CustomCardEditorForm {
  return {
    ...form,
    category: result.category ?? form.category,
    strings: result.strings?.some((text) => text.trim()) === true ? result.strings : form.strings
  }
}

export function validateCustomCardForm(
  editingId: number | null,
  form: CustomCardEditorForm,
  hasScript: boolean
): CustomCardValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const type = normalizeCardType(form.type)
  const kind = getCardKind(type)
  const isMonster = kind === 'monster'
  const isLink = isMonster && hasLink(type)
  const isPendulum = isMonster && hasPendulum(type)

  if (!form.name.trim()) errors.push('卡名不能为空')

  if (editingId === null && form.id.trim()) {
    const id = Number(form.id.trim())
    if (!Number.isInteger(id) || id <= 0 || id > 0x7fffffff) {
      errors.push('卡密必须是 1–2147483647 的整数')
    }
  }

  const mainTypes = [CardType.MONSTER, CardType.SPELL, CardType.TRAP].filter(
    (mask) => (type & mask) !== 0
  )
  if (mainTypes.length !== 1) errors.push('卡片种类只能选择怪兽、魔法或陷阱')

  if (isLink && isPendulum) errors.push('连接怪兽不能是灵摆怪兽')
  if (isMonster) {
    const level = Number(form.level.trim())
    if (!Number.isInteger(level)) {
      errors.push(`${isLink ? '连接值' : '等级/阶级'}必须是整数`)
    } else if (isLink) {
      if (level < 1 || level > 8) errors.push('连接值必须在 1–8 之间')
      const arrows = linkMarkerCount(form.markers)
      if (form.markers === 0) errors.push('连接怪兽至少需要一个连接箭头')
      else if (level !== arrows) warnings.push(`连接值为 ${level}，但箭头数量为 ${arrows}，请确认`)
    } else if (level < 0 || level > 13) {
      errors.push('等级/阶级必须在 0–13 之间')
    }

    if (isPendulum) {
      const left = Number(form.scaleLeft.trim())
      const right = Number(form.scaleRight.trim())
      if (!Number.isInteger(left) || left < 0 || left > 13) errors.push('左刻度必须在 0–13 之间')
      if (!Number.isInteger(right) || right < 0 || right > 13) errors.push('右刻度必须在 0–13 之间')
    }

    for (const [label, value] of [
      ['攻击力', form.atk],
      ['守备力', form.def]
    ] as const) {
      if (label === '守备力' && isLink) continue
      const text = value.trim()
      if (!text || text === '?' || text === '？') continue
      const numeric = Number(text)
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99999) {
        errors.push(`${label}必须是 0–99999 的整数，或留空表示 ?`)
      }
    }
  }

  if (form.alias.trim()) {
    const alias = Number(form.alias.trim())
    if (!Number.isInteger(alias) || alias < 0 || alias > 0x7fffffff) {
      errors.push('同名卡必须是 0–2147483647 的整数')
    }
  }

  for (const slot of form.setcode) {
    if (slot.trim() && !/^[0-9a-f]{1,4}$/i.test(slot.trim())) {
      errors.push('字段代码必须是 1–4 位十六进制')
      break
    }
  }

  if (hasScript === false && form.desc.trim() && !(isMonster && !hasEffect(type))) {
    warnings.push('已填写效果文本，但没有关联脚本；这张卡在对局中不会产生效果')
  }

  return { errors, warnings }
}
