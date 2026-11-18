import { readdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import {
  summarizeStepProvenance,
  type DuelDocument,
  type DuelDocumentEntry,
  type DuelDocumentFolder,
  type DuelDocumentReadResult
} from '@shared/index'

type ReadDocument = (path: string) => DuelDocumentReadResult

export class DuelDocumentIndex {
  private entries = new Map<string, { stamp: string; entry: DuelDocumentEntry }>()

  scan(path: string, readDocument: ReadDocument): DuelDocumentFolder {
    const seen = new Set<string>()
    const root = this.scanFolder(path, '', seen, readDocument)
    for (const path of this.entries.keys()) {
      if (!seen.has(path)) this.entries.delete(path)
    }
    return root
  }

  private scanFolder(
    absolutePath: string,
    relativePath: string,
    seen: Set<string>,
    readDocument: ReadDocument
  ): DuelDocumentFolder {
    const folder: DuelDocumentFolder = {
      name: basename(absolutePath),
      path: relativePath,
      folders: [],
      documents: []
    }
    let entries
    try {
      entries = readdirSync(absolutePath, { withFileTypes: true })
    } catch {
      return folder
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name.startsWith('.')) continue
      const fullPath = join(absolutePath, entry.name)
      if (entry.isDirectory()) {
        folder.folders.push(
          this.scanFolder(
            fullPath,
            relativePath ? `${relativePath}/${entry.name}` : entry.name,
            seen,
            readDocument
          )
        )
        continue
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.ygoduel')) continue
      seen.add(fullPath)
      try {
        const stat = statSync(fullPath)
        const stamp = [stat.mtimeMs, stat.ctimeMs, stat.size, stat.ino].join('/')
        const cached = this.entries.get(fullPath)
        if (cached?.stamp === stamp && cached.entry.categoryPath === relativePath) {
          folder.documents.push(cached.entry)
          continue
        }
        const read = readDocument(fullPath)
        const state = read.document?.state ?? read.recoveryState
        if (!state) continue
        const entry = this.toEntry(fullPath, state, relativePath, stat.mtimeMs)
        this.entries.set(fullPath, { stamp, entry })
        folder.documents.push(entry)
      } catch {
        continue
      }
    }
    return folder
  }

  private toEntry(
    filePath: string,
    state: DuelDocument['state'],
    categoryPath: string,
    updatedAt: number
  ): DuelDocumentEntry {
    const name = basename(filePath, extname(filePath))
    const title = state.title?.trim() || name
    const provenance = summarizeStepProvenance(state.steps)
    return {
      filePath,
      fileName: basename(filePath),
      name,
      title,
      categoryPath,
      updatedAt,
      ...provenance
    }
  }
}
