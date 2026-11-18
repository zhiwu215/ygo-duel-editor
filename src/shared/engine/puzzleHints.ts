export function normalizePuzzleHints(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .filter((part) => part.trim())
}

export function writePuzzleHints(hints: string[]): string[] {
  return hints
    .filter((part) => part.trim())
    .map((part) => {
      const literal = part.replace(/[\\"\x00-\x1f]/g, (char) => {
        if (char === '\\' || char === '"') return '\\' + char
        if (char === '\n') return '\\n'
        return '\\' + char.charCodeAt(0).toString().padStart(3, '0')
      })
      return 'Debug.ShowHint("' + literal + '")'
    })
}

export function readPuzzleHint(line: string): string | undefined {
  const match =
    /^Debug\.ShowHint\s*\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1\s*\)\s*;?\s*(?:--.*)?$/.exec(line)
  if (!match) return undefined
  return match[2].replace(/\\(\d{1,3}|[nrt\\"'])/g, (_, escape: string) => {
    if (/^\d/.test(escape)) return String.fromCharCode(Number(escape))
    if (escape === 'n') return '\n'
    if (escape === 'r') return '\r'
    if (escape === 't') return '\t'
    return escape
  })
}
