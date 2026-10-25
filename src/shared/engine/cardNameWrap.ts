export const CARD_NAME_WRAPPERS = ['「」', '『』', '[]', '【】'] as const

export type CardNameWrapper = (typeof CARD_NAME_WRAPPERS)[number]

export const DEFAULT_CARD_NAME_WRAPPER: CardNameWrapper = '「」'

export function normalizeCardNameWrapper(value: string | undefined): CardNameWrapper {
  return CARD_NAME_WRAPPERS.includes(value as CardNameWrapper)
    ? (value as CardNameWrapper)
    : DEFAULT_CARD_NAME_WRAPPER
}

export function cardNameWrapperPair(value: string | undefined): { open: string; close: string } {
  const normalized = normalizeCardNameWrapper(value)
  return { open: normalized[0], close: normalized[1] }
}
