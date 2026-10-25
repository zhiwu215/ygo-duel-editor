const SCRIPT_KEY_PATTERN = /"script"\s*:\s*"/

const LUA_FENCE_PATTERN = /```(?:lua)?[ \t]*\n([\s\S]*?)```/i

const LUA_START_PATTERN =
  /(?:^|\n)(?:--\s*c\d+\.lua|local\s+s\s*,\s*id|function\s+c\d+\.initial_effect)/

const ESCAPE_CHARS: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t'
}

const UNICODE_ESCAPE_PATTERN = /^[0-9a-fA-F]{4}$/

function decodeJsonStringPrefix(raw: string): string {
  let text = ''
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (char === '"') break
    if (char !== '\\') {
      text += char
      continue
    }
    const escape = raw[index + 1]
    if (escape === undefined) break
    if (escape === 'u') {
      const hex = raw.slice(index + 2, index + 6)
      if (!UNICODE_ESCAPE_PATTERN.test(hex)) break
      text += String.fromCharCode(parseInt(hex, 16))
      index += 5
      continue
    }
    const decoded = ESCAPE_CHARS[escape]
    if (decoded === undefined) break
    text += decoded
    index += 1
  }
  return text
}

export function extractStreamingScript(raw: string): string {
  const match = SCRIPT_KEY_PATTERN.exec(raw)
  if (!match) return ''
  return decodeJsonStringPrefix(raw.slice(match.index + match[0].length))
}

export function extractLuaScriptBlock(raw: string): string | null {
  const match = LUA_FENCE_PATTERN.exec(raw)
  if (!match) return null
  const text = match[1].trim()
  return text.length > 0 && LUA_START_PATTERN.test(text) ? text : null
}
