import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  Trash2
} from 'lucide-react'
import { TextLibraryEntry, TextLibraryFolder, TextLibraryTree } from '@shared/index'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { cn } from '../../lib/utils'
import { countTextLibraryEntries } from '../../utils/textLibraryTree'

interface TextLibrarySidebarProps {
  tree: TextLibraryTree | null
  loading: boolean
  refreshing: boolean
  search: string
  selectedPath: string | null
  onSearchChange: (value: string) => void
  onSelect: (entry: TextLibraryEntry) => void
  onDelete: (entry: TextLibraryEntry) => void
  onDeleteFolder: (folder: TextLibraryFolder) => void
  onRefresh: () => void
}

export const TextLibrarySidebar: React.FC<TextLibrarySidebarProps> = ({
  tree,
  loading,
  refreshing,
  search,
  selectedPath,
  onSearchChange,
  onSelect,
  onDelete,
  onDeleteFolder,
  onRefresh
}) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const query = search.trim()

  const toggleFolder = (path: string): void => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderEntry = (entry: TextLibraryEntry, indent: number): React.JSX.Element => {
    const active = entry.path === selectedPath
    return (
      <div
        key={entry.path}
        style={{ paddingLeft: 8 + indent }}
        className={cn(
          'group flex w-full items-center rounded-md pr-1 text-[11px] transition-colors',
          active
            ? 'bg-foreground/10 text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(entry)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(entry)
          }}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-40 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:opacity-100',
            active ? 'opacity-100' : 'group-hover:opacity-100'
          )}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    )
  }

  const renderFolder = (folder: TextLibraryFolder, depth: number): React.JSX.Element => {
    const isCollapsed = collapsed.has(folder.path) && !query
    return (
      <div key={folder.path}>
        <div className="group flex w-full items-center rounded-md pr-1 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted/50">
          <button
            type="button"
            onClick={() => toggleFolder(folder.path)}
            style={{ paddingLeft: 4 + depth * 12 }}
            className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {isCollapsed ? (
              <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )}
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDeleteFolder(folder)
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-40 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {!isCollapsed && (
          <div>
            {folder.folders.map((child) => renderFolder(child, depth + 1))}
            {folder.entries.map((entry) => renderEntry(entry, 20 + depth * 12))}
          </div>
        )}
      </div>
    )
  }

  const total = tree ? countTextLibraryEntries(tree) : 0

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-card/30">
      <div className="shrink-0 border-b border-border/60 p-2">
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索标题或分类"
              className="h-7 pl-7 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !tree || total === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-12 text-center text-[11px] text-muted-foreground">
            <Folder className="h-8 w-8 opacity-30" />
            <span>{query ? '没有匹配的文本' : '文本库还是空的'}</span>
          </div>
        ) : (
          <div className="p-1.5">
            {tree.folders.map((folder) => renderFolder(folder, 0))}
            {tree.entries.map((entry) => renderEntry(entry, 6))}
          </div>
        )}
      </ScrollArea>

      {total > 0 && (
        <div className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
          共 {total} 篇
        </div>
      )}
    </aside>
  )
}
