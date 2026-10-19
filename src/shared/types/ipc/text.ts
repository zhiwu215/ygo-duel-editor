export type TextSplitProgress = 'raw' | 'splitting' | 'split' | 'done'

export interface TextMeta {
  id: string
  filePath: string
  title: string
  author?: string

  wordCount?: number
  progress: TextSplitProgress
  chapterCount?: number
  updatedAt: number
}

export interface TextChapter {
  id: string

  textId: string

  title: string

  index: number

  wordCount: number

  content?: string
}
