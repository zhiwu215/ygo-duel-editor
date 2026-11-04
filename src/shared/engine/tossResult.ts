import type { TossKind } from '../types/duelLog'

const COIN_FACE_NAMES = ['反面', '正面']

export const TOSS_LABELS: Record<TossKind, string> = {
  coin: '投掷硬币结果：',
  dice: '投掷骰子结果：'
}

function tossFaceText(kind: TossKind, value: number): string {
  return kind === 'coin' ? (COIN_FACE_NAMES[value] ?? '？') : String(value)
}

export function formatTossFaces(kind: TossKind, results: number[]): string {
  return results.map((value) => `[${tossFaceText(kind, value)}]`).join('')
}

export function formatTossResult(kind: TossKind, results: number[]): string {
  return `${TOSS_LABELS[kind]}${formatTossFaces(kind, results)}`
}
