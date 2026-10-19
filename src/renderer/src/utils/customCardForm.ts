import { CardType, CustomCardInput } from '@shared/index'
import type { CustomCardEditorForm } from '../stores/useCustomCardStore'

const STAT_UNKNOWN = -2

export function parseStat(value: string): number {
  const text = value.trim()
  if (!text) return STAT_UNKNOWN
  const num = Number(text)
  if (!Number.isFinite(num)) return STAT_UNKNOWN
  return Math.trunc(num)
}

export function parseCount(value: string, fallback = 0): number {
  const num = Number(value.trim())
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.min(255, Math.trunc(num))
}

export function formatScriptSize(size: number | undefined): string {
  if (!size || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

export function buildInput(
  editingId: number | null,
  form: CustomCardEditorForm,
  staged: { path: string; preview: string } | null
): CustomCardInput {
  const kind = form.type & (CardType.MONSTER | CardType.SPELL | CardType.TRAP)
  const isMonster = kind === CardType.MONSTER
  const isSpell = kind === CardType.SPELL
  const isLink = isMonster && (form.type & CardType.LINK) !== 0
  const isPendulum = isMonster && (form.type & CardType.PENDULUM) !== 0

  const base = {
    id: editingId ?? undefined,
    name: form.name,
    desc: form.desc,
    imageSourcePath: staged?.path
  }
  if (isMonster) {
    const level = parseCount(form.level)
    const lscale = isPendulum ? parseCount(form.scaleLeft ?? '') : 0
    const rscale = isPendulum ? parseCount(form.scaleRight ?? '') : 0
    return {
      ...base,
      type: form.type,
      attribute: isMonster ? form.attribute : 0,
      race: isMonster ? form.race : 0,
      level: lscale * 0x1000000 + rscale * 0x10000 + level,
      atk: parseStat(form.atk),
      def: isLink ? form.markers : parseStat(form.def)
    }
  }
  return {
    ...base,
    type: isSpell ? form.type : form.type,
    attribute: 0,
    race: 0,
    level: 0,
    atk: 0,
    def: 0
  }
}
