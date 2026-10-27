import { DuelDocumentEntry, DuelDocumentFolder, DuelDocumentTree } from '@shared/index'

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

function findFolder(folders: DuelDocumentFolder[], path: string): DuelDocumentFolder | null {
  for (const folder of folders) {
    if (folder.path === path) return folder
    const found = findFolder(folder.folders, path)
    if (found) return found
  }
  return null
}

function documentsOf(tree: DuelDocumentTree, folderPath: string): DuelDocumentEntry[] {
  return folderPath ? (findFolder(tree.folders, folderPath)?.documents ?? []) : tree.documents
}

export function findDocumentTitleConflict(
  tree: DuelDocumentTree,
  folderPath: string,
  title: string,
  excludeFilePath?: string
): DuelDocumentEntry | null {
  const documents = documentsOf(tree, folderPath)
  const target = normalizeTitle(title)
  return (
    documents.find(
      (entry) => entry.filePath !== excludeFilePath && normalizeTitle(entry.title) === target
    ) ?? null
  )
}

export function nextAvailableDocumentTitle(
  tree: DuelDocumentTree | null,
  folderPath: string,
  base: string
): string {
  const fallback = base.trim() || '未命名对局'
  if (!tree) return fallback
  const used = new Set<string>()
  for (const entry of documentsOf(tree, folderPath)) {
    used.add(normalizeTitle(entry.title))
    used.add(normalizeTitle(entry.name))
  }
  let candidate = fallback
  let index = 2
  while (used.has(normalizeTitle(candidate))) {
    candidate = `${fallback} ${index}`
    index += 1
  }
  return candidate
}
