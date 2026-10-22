export interface WebSearchSource {
  url: string
  title?: string
  snippet?: string
  publishedAt?: string
}

export interface WebSearchResult {
  content?: string
  sources: WebSearchSource[]
  truncated: boolean
}

export interface WebFetchResult {
  url: string
  statusCode: number
  content: string
  truncated: boolean
}

export class WebError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'WebError'
    this.code = code
  }
}
