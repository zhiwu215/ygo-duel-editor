import type { CustomCard } from '@shared/index'

const SCRIPT_HEADER_PATTERN = /^--\s*c\d+\.lua/i
const GET_ID_PATTERN = /local\s+s\s*,\s*id(?:\s*,\s*o)?\s*=\s*GetID\(\)/
const MODERN_INITIAL_EFFECT_PATTERN = /function\s+s\.initial_effect\s*\(/
const LEGACY_INITIAL_EFFECT_PATTERN = /function\s+c(\d+)\.initial_effect\s*\(/

export function normalizeScriptText(raw: string, card: Pick<CustomCard, 'id' | 'name'>): string {
  let text = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim()
  const fenced = /```[a-z]*[ \t]*\n([\s\S]*?)\n```/i.exec(text)
  if (fenced) text = fenced[1].trim()

  const header = `-- c${card.id}.lua${card.name.trim() ? ` ${card.name.trim()}` : ''}`
  const lines = text.split('\n')
  if (lines.length > 0 && SCRIPT_HEADER_PATTERN.test(lines[0].trim())) {
    lines[0] = header
    text = lines.join('\n')
  } else {
    text = `${header}\n${text}`
  }
  return `${text.trimEnd()}\n`
}

export function scriptStructureProblem(
  script: string,
  cardCode: number,
  cardDesc: string
): string | null {
  const modern = GET_ID_PATTERN.test(script) && MODERN_INITIAL_EFFECT_PATTERN.test(script)
  const legacy = LEGACY_INITIAL_EFFECT_PATTERN.exec(script)
  if (!modern && !legacy) {
    return '缺少 initial_effect 函数（应为 local s,id,o=GetID() + function s.initial_effect(c)，或 function c<卡密>.initial_effect(c)）'
  }
  if (legacy && Number(legacy[1]) !== cardCode) {
    return `initial_effect 使用了参考卡的卡密 c${legacy[1]}，应改成目标卡 c${cardCode}`
  }
  if (
    /超量/.test(cardDesc) &&
    /成为.*素材|作为.*素材/.test(cardDesc) &&
    /EVENT_BE_MATERIAL/.test(script) &&
    /EFFECT_TYPE_TRIGGER_[OF]/.test(script) &&
    !/EFFECT_TYPE_CONTINUOUS/.test(script)
  ) {
    return '「成为超量素材」不能给素材卡本身注册触发效果（素材在超量素材区时不会发动）；应注册 CONTINUOUS 的 EVENT_BE_MATERIAL，并把后续效果注册到 GetReasonCard() 返回的超量怪兽上'
  }
  return null
}
