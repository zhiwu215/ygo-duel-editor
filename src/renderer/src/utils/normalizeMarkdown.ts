const CODE_SEGMENT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g

const EDGE_WHITESPACE = /^[ \t\u3000]+|[ \t\u3000]+$/g

function normalizeEmphasis(text: string): string {
  return text
    .replace(/\*\*([^\n*]*?)\*\*/g, (match, inner: string) => {
      const trimmed = inner.replace(EDGE_WHITESPACE, '')
      return trimmed.length > 0 ? `**${trimmed}**` : match
    })
    .replace(/__([^\n_]*?)__/g, (match, inner: string) => {
      const trimmed = inner.replace(EDGE_WHITESPACE, '')
      return trimmed.length > 0 ? `__${trimmed}__` : match
    })
}

export function normalizeMarkdown(text: string): string {
  return text
    .split(CODE_SEGMENT)
    .map((part, index) => (index % 2 === 1 ? part : normalizeEmphasis(part)))
    .join('')
}
