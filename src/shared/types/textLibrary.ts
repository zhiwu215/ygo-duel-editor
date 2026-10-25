export interface TextLibraryEntry {
  path: string
  title: string
  categoryPath: string
  wordCount: number
  updatedAt: number
}

export interface TextLibraryFolder {
  name: string
  path: string
  folders: TextLibraryFolder[]
  entries: TextLibraryEntry[]
}

export interface TextLibraryTree {
  folders: TextLibraryFolder[]
  entries: TextLibraryEntry[]
}

export interface TextLibraryListResult {
  success: boolean
  tree?: TextLibraryTree
  error?: string
}

export interface TextLibraryReadResult {
  success: boolean
  entry?: TextLibraryEntry
  content?: string
  error?: string
}

export interface TextLibrarySaveRequest {
  sourceFilePath: string | null
  title: string
  text: string
}

export interface TextLibraryWriteResult {
  success: boolean
  entry?: TextLibraryEntry
  overwritten?: boolean
  createdNew?: boolean
  error?: string
}

export interface TextLibraryDeleteResult {
  success: boolean
  error?: string
}

export interface TextLibraryExportResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}
