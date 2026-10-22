export const FONT_SIZE_ROLES = ['chat', 'content', 'code'] as const

export type FontSizeRole = (typeof FONT_SIZE_ROLES)[number]

export interface FontSizeSpec {
  min: number
  max: number
  default: number
}

export const FONT_SIZE_SPECS = {
  chat: { min: 11, max: 20, default: 14 },
  content: { min: 11, max: 24, default: 14 },
  code: { min: 9, max: 18, default: 12 }
} as const satisfies Record<FontSizeRole, FontSizeSpec>

export type FontSizes = Readonly<Record<FontSizeRole, number>>

export const DEFAULT_FONT_SIZES: FontSizes = Object.freeze({
  chat: FONT_SIZE_SPECS.chat.default,
  content: FONT_SIZE_SPECS.content.default,
  code: FONT_SIZE_SPECS.code.default
})

export function clampFontSize(role: FontSizeRole, value: number): number {
  const spec = FONT_SIZE_SPECS[role]
  if (!Number.isFinite(value)) return spec.default
  return Math.min(spec.max, Math.max(spec.min, Math.round(value)))
}

export function normalizeFontSizes(value?: Partial<Record<FontSizeRole, number>>): FontSizes {
  return {
    chat: clampFontSize('chat', value?.chat ?? FONT_SIZE_SPECS.chat.default),
    content: clampFontSize('content', value?.content ?? FONT_SIZE_SPECS.content.default),
    code: clampFontSize('code', value?.code ?? FONT_SIZE_SPECS.code.default)
  }
}
