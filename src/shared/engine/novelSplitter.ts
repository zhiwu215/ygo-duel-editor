export interface ParsedChapter {
  title: string
  index: number
  content: string
  wordCount: number
}

export interface SplitResult {
  chapters: ParsedChapter[]

  strategy: 'heading' | 'regex' | 'whole'
}

const HEADING_PATTERNS: RegExp[] = [
  /^\s*第\s*[0-9零一二三四五六七八九十百千万两]+\s*[章回节卷話话部]\s*[^\n]{0,40}$/,
  /^\s*第\s*[0-9零一二三四五六七八九十百千万两]+\s*[卷部]\s*[^\n]{0,40}$/,
  /^\s*(?:chapter|CHAPTER|Chapter)\s+[0-9]+[^\n]{0,40}$/,
  /^\s*(?:序章|楔子|引子|前言|后记|尾声|终章|终|番外)[^\n]{0,30}$/,
  /^\s*[0-9]{1,4}\s*[.、．]\s*\S[^\n]{0,40}$/,
  /^\s*【[^\n]{1,30}】\s*$/
]

export function countWords(text: string): number {
  if (!text) return 0
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g)?.length ?? 0
  const rest = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + rest
}

function normalizeText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/\uFEFF/g, '')
  )
}

export function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 60) return false
  return HEADING_PATTERNS.some((re) => re.test(trimmed))
}

function tidyContent(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '')
}

export function splitNovelChapters(rawText: string, fallbackTitle: string): SplitResult {
  const text = normalizeText(rawText)
  if (!text.trim()) {
    return { chapters: [], strategy: 'whole' }
  }

  const lines = text.split('\n')
  const headingLineIndexes: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isHeadingLine(lines[i])) headingLineIndexes.push(i)
  }

  if (headingLineIndexes.length < 2 || headingLineIndexes.length > lines.length / 2) {
    return {
      chapters: [
        {
          title: fallbackTitle,
          index: 1,
          content: tidyContent(text),
          wordCount: countWords(text)
        }
      ],
      strategy: 'whole'
    }
  }

  const chapters: ParsedChapter[] = []
  for (let i = 0; i < headingLineIndexes.length; i++) {
    const start = headingLineIndexes[i]
    const end = i + 1 < headingLineIndexes.length ? headingLineIndexes[i + 1] : lines.length
    const rawTitle = lines[start].trim()
    const body = tidyContent(lines.slice(start + 1, end).join('\n'))

    const content = tidyContent(`${rawTitle}\n\n${body}`)
    if (!content) continue
    chapters.push({
      title:
        i === 0
          ? rawTitle.replace(/^第\s*[0-9零一二三四五六七八九十百千万两]+\s*[章回节卷]\s*/, '') ||
            rawTitle
          : rawTitle,
      index: chapters.length + 1,
      content,
      wordCount: countWords(content)
    })
  }

  if (chapters.length === 0) {
    return {
      chapters: [
        {
          title: fallbackTitle,
          index: 1,
          content: tidyContent(text),
          wordCount: countWords(text)
        }
      ],
      strategy: 'whole'
    }
  }

  return { chapters, strategy: 'heading' }
}

export function inferNovelTitle(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[（(【[].*?[）)】\]]/g, '')
      .replace(/[-_]+(txt|epub|md|txt版|全文|完结|精校版|校对版)$/i, '')
      .trim() || '未命名资料'
  )
}

export function extractEpubText(raw: string): string {
  if (!raw.includes('<')) return ''
  return raw
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
