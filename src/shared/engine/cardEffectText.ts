const CIRCLED_NUMBER_PATTERN = /(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/u

export function splitCardEffectText(desc: string | undefined): string[] {
  const normalized = (desc || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!normalized) return []
  return normalized
    .split(/\n+/)
    .flatMap((line) => line.split(CIRCLED_NUMBER_PATTERN))
    .map((part) => part.trim())
    .filter(Boolean)
}
