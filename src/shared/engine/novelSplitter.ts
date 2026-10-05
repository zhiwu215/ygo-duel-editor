/**
 * 小说文本章节拆分器
 * 平台无关 (@shared)，两进程共享纯函数
 *
 * 目标不是做通用 EPUB 解析器，而是把导入的正文切成**可选取的章节单元**，
 * 供创作者挑某几章喂给 AI 编排决斗剧情。拆分规则偏保守：
 * 宁可少切（整本当一章），也不要切碎导致语义断裂。
 */

/** 单章拆分结果 */
export interface ParsedChapter {
  title: string
  index: number
  content: string
  wordCount: number
}

/** 拆分统计 */
export interface SplitResult {
  chapters: ParsedChapter[]
  /** 未识别到任何章节标题时的回退提示 */
  strategy: 'heading' | 'regex' | 'whole'
}

/**
 * 章节标题候选行。
 *
 * 覆盖中文网文最常见的几种写法：
 * `第一章`、`第1章`、`Chapter 3`、`卷一 …`、`3.标题`、`序章`、`楔子`、`终章`
 */
const HEADING_PATTERNS: RegExp[] = [
  /^\s*第\s*[0-9零一二三四五六七八九十百千万两]+\s*[章回节卷話话部]\s*[^\n]{0,40}$/,
  /^\s*第\s*[0-9零一二三四五六七八九十百千万两]+\s*[卷部]\s*[^\n]{0,40}$/,
  /^\s*(?:chapter|CHAPTER|Chapter)\s+[0-9]+[^\n]{0,40}$/,
  /^\s*(?:序章|楔子|引子|前言|后记|尾声|终章|终|番外)[^\n]{0,30}$/,
  /^\s*[0-9]{1,4}\s*[.、．]\s*\S[^\n]{0,40}$/,
  /^\s*【[^\n]{1,30}】\s*$/
]

/** 统计「字数」：CJK 按字计，其余按词/空白分隔计 */
export function countWords(text: string): number {
  if (!text) return 0
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g)?.length ?? 0
  const rest = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + rest
}

/** 去掉 CRLF，统一换行；同时剔除零宽字符 */
function normalizeText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/\uFEFF/g, '')
  )
}

/** 判断一行是否像章节标题 */
export function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 60) return false
  return HEADING_PATTERNS.some((re) => re.test(trimmed))
}

/** 清理正文：压缩 3 个以上连续空行，去掉首尾空行 */
function tidyContent(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '')
}

/**
 * 按章节标题拆分正文
 *
 * @param rawText 原始正文
 * @param fallbackTitle 未拆分出章节时使用的书名
 */
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

  // 标题数必须 >= 2，否则没有章节结构。
  // 注意**不能**用「标题数 / 总行数」做上限判断：真实小说的章节正文往往只有几行，
  // 短章节多时这个比例会超过 1/4，把明明有章节结构的书误判成整本。
  // 改用「标题数不超过总行数的一半」这个宽松上界，只挡极端误判。
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
    // 标题行本身也计入内容，方便 AI 看到「第一章 xxx」这样的上下文
    const content = tidyContent(`${rawTitle}\n\n${body}`)
    if (!content) continue
    chapters.push({
      // 首个标题若与书名同名（部分站点会这么写），去掉重复的序号前缀
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

/**
 * 从导入文件名推断书名（去掉扩展名与常见噪声后缀）
 */
export function inferNovelTitle(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[（(【[].*?[）)】\]]/g, '')
      .replace(/[-_]+(txt|epub|md|txt版|全文|完结|精校版|校对版)$/i, '')
      .trim() || '未命名资料'
  )
}

/**
 * 极简 EPUB 正文提取。
 *
 * EPUB 是 zip 包，完整解包需要额外依赖；这里只做「把 HTML 标签剥掉、
 * 段落换行」的保守处理，足够喂给 AI 理解剧情，不追求还原排版。
 * 若文件不是合法 zip / 找不到正文，返回空串由调用方降级处理。
 */
export function extractEpubText(raw: string): string {
  // EPUB 内容是 deflate 压缩的二进制，交给调用方用 Node 侧解析；
  // 这里仅处理「解压后已是 XML 文本」的情况（部分工具导出的是明文 xml）。
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
