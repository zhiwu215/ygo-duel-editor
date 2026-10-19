const GROUP_SEP = '/'

export function groupLeafName(path: string): string {
  const i = path.lastIndexOf(GROUP_SEP)
  return i < 0 ? path : path.slice(i + 1)
}

export function groupParentPath(path: string): string | null {
  const i = path.lastIndexOf(GROUP_SEP)
  return i < 0 ? null : path.slice(0, i)
}

export function groupDepth(path: string): number {
  return path.split(GROUP_SEP).filter(Boolean).length
}

export function groupChildPath(parent: string | null | undefined, name: string): string {
  const leaf = name.trim()
  return parent ? `${parent}${GROUP_SEP}${leaf}` : leaf
}

export function isGroupDescendant(path: string, ancestor: string): boolean {
  return path.startsWith(`${ancestor}${GROUP_SEP}`)
}

export function groupAncestorPaths(path: string): string[] {
  const segments = path.split(GROUP_SEP).filter(Boolean)
  return segments.map((_, i) => segments.slice(0, i + 1).join(GROUP_SEP))
}
