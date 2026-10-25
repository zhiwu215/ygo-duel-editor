const CIRCLED_NUMBERS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const EFFECT_MARKER = new RegExp(`[${CIRCLED_NUMBERS}]\\s*[:：]`, 'gu')
const CIRCLED_START = new RegExp(`^[${CIRCLED_NUMBERS}]`, 'u')

function normalizeText(desc: string | undefined): string {
  return (desc || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
}

function splitAtEffectMarkers(text: string): string[] | null {
  const starts: number[] = []
  for (const match of text.matchAll(EFFECT_MARKER)) {
    starts.push(match.index)
  }
  if (starts.length === 0) return null
  const parts: string[] = []
  const preamble = text.slice(0, starts[0]).trim()
  if (preamble) parts.push(preamble)
  starts.forEach((start, index) => {
    const end = starts[index + 1] ?? text.length
    const part = text.slice(start, end).trim()
    if (part) parts.push(part)
  })
  return parts
}

function splitAtLineStarts(text: string): string[] {
  const parts: string[] = []
  let current = ''
  for (const line of text.split(/\n+/)) {
    if (CIRCLED_START.test(line.trim()) && current) {
      parts.push(current.trim())
      current = line
    } else {
      current += `${current ? '\n' : ''}${line}`
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

export function splitCardEffectText(desc: string | undefined): string[] {
  const normalized = normalizeText(desc)
  if (!normalized) return []
  return splitAtEffectMarkers(normalized) ?? splitAtLineStarts(normalized)
}
