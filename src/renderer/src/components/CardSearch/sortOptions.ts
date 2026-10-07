export interface CardSortOption {
  value: 'atk' | 'def' | 'level' | 'name'
  label: string
  order: 'ASC' | 'DESC'
}

export const SORT_OPTIONS: CardSortOption[] = [
  { value: 'level', label: '星数↓', order: 'DESC' },
  { value: 'atk', label: '攻击↓', order: 'DESC' },
  { value: 'def', label: '守备↓', order: 'DESC' },
  { value: 'name', label: '名称↑', order: 'ASC' }
]
