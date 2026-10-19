import { NumericCompareOp } from '@shared/index'

export const OP_PREFIX: Record<NumericCompareOp, string> = {
  eq: '',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  unknown: '?'
}

export const PREFIX_TO_OP: Record<string, NumericCompareOp> = {
  '>=': 'gte',
  '<=': 'lte',
  '>': 'gt',
  '<': 'lt',
  '=': 'eq'
}

export function filterText(value: number | undefined, op: NumericCompareOp): string {
  if (op === 'unknown') return '?'
  if (value === undefined || Number.isNaN(value)) return ''
  return `${OP_PREFIX[op]}${value}`
}

export function parseFilterText(
  text: string,
  allowUnknown: boolean
): { value: number | undefined; op: NumericCompareOp } {
  const raw = text.trim()
  if (raw === '') return { value: undefined, op: 'eq' }
  if (raw === '?') return { value: undefined, op: allowUnknown ? 'unknown' : 'eq' }
  const matched = /^(>=|<=|>|<|=)?\s*(-?\d+)$/.exec(raw)
  if (!matched) return { value: undefined, op: 'eq' }
  return { value: parseInt(matched[2], 10), op: PREFIX_TO_OP[matched[1] ?? '='] }
}
