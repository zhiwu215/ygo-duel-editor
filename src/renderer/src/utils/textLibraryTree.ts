import { TextLibraryEntry, TextLibraryFolder, TextLibraryTree } from '@shared/index'

export function filterTextLibraryTree(tree: TextLibraryTree, query: string): TextLibraryTree {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return tree

  const matchesEntry = (entry: TextLibraryEntry): boolean =>
    entry.title.toLowerCase().includes(keyword) ||
    entry.categoryPath.toLowerCase().includes(keyword)

  const filterFolder = (folder: TextLibraryFolder): TextLibraryFolder | null => {
    if (folder.name.toLowerCase().includes(keyword)) return folder
    const folders = folder.folders
      .map(filterFolder)
      .filter((item): item is TextLibraryFolder => item !== null)
    const entries = folder.entries.filter(matchesEntry)
    if (folders.length === 0 && entries.length === 0) return null
    return { ...folder, folders, entries }
  }

  return {
    folders: tree.folders
      .map(filterFolder)
      .filter((item): item is TextLibraryFolder => item !== null),
    entries: tree.entries.filter(matchesEntry)
  }
}

export function findTextLibraryEntry(tree: TextLibraryTree, path: string): TextLibraryEntry | null {
  for (const entry of tree.entries) {
    if (entry.path === path) return entry
  }
  const searchFolder = (folder: TextLibraryFolder): TextLibraryEntry | null => {
    for (const entry of folder.entries) {
      if (entry.path === path) return entry
    }
    for (const child of folder.folders) {
      const found = searchFolder(child)
      if (found) return found
    }
    return null
  }
  for (const folder of tree.folders) {
    const found = searchFolder(folder)
    if (found) return found
  }
  return null
}

export function countTextLibraryEntries(tree: TextLibraryTree): number {
  const countFolder = (folder: TextLibraryFolder): number =>
    folder.entries.length + folder.folders.reduce((sum, child) => sum + countFolder(child), 0)
  return tree.entries.length + tree.folders.reduce((sum, folder) => sum + countFolder(folder), 0)
}
