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

export function findDocumentTitleConflict(
  tree: DuelDocumentTree,
  folderPath: string,
  title: string,
  excludeFilePath?: string
): DuelDocumentEntry | null {
  const documents = folderPath
    ? (findFolder(tree.folders, folderPath)?.documents ?? [])
    : tree.documents
  const target = normalizeTitle(title)
  return (
    documents.find(
      (entry) => entry.filePath !== excludeFilePath && normalizeTitle(entry.title) === target
    ) ?? null
  )
}
