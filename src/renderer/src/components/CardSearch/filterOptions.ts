import { CardPoolFilter, CardPoolSchema, LimitFilter, poolOptions } from '@shared/index'

export { NONE_LABEL } from '@shared/index'

export const LIMIT_OPTIONS: Array<{ value: LimitFilter; label: string }> = [
  { value: 0, label: '不限' },
  { value: 1, label: '禁止' },
  { value: 2, label: '限制' },
  { value: 3, label: '准限制' }
]

export interface CardPoolOptionItem {
  value: CardPoolFilter
  label: string
}

export function cardPoolOptions(schema: CardPoolSchema): CardPoolOptionItem[] {
  return [
    { value: 'any', label: '全部卡池' },
    ...poolOptions(schema).map((pool) => ({ value: pool.id, label: pool.label }))
  ]
}
