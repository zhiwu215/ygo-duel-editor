import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search } from 'lucide-react'
import { DuelDocumentEntry, DuelDocumentFolder, DuelDocumentTree } from '@shared/index'
import { Input } from '../ui/input'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { StepProvenanceBadge } from '../common/StepProvenanceBadge'
import { alertDialog, confirmDialog, promptDialog } from '../../stores/useDialogStore'
import { buildDuelDocument } from '../../utils/duelDocumentBuild'
import { flushDuelDocumentAutosave } from '../../utils/duelDocumentAutosave'
import { findDocumentTitleConflict } from '../../utils/duelDocumentTree'
import { cn } from '../../lib/utils'

interface ScreenplayLibrarySidebarProps {
  tree: DuelDocumentTree | null
  currentFilePath: string | null
  onOpen: (filePath: string) => void
  onCurrentDocumentChanged: (filePath: string | null) => void
  onRefresh: () => Promise<void>
  className?: string
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function titleConflictMessage(
  tree: DuelDocumentTree | null,
  folderPath: string,
  title: string,
  excludeFilePath?: string
): string | null {
  if (!tree) return null
  const existing = findDocumentTitleConflict(tree, folderPath, title, excludeFilePath)
  return existing ? `已存在同名台本「${existing.title}」，请换一个标题。` : null
}

export const ScreenplayLibrarySidebar: React.FC<ScreenplayLibrarySidebarProps> = ({
  tree,
  currentFilePath,
  onOpen,
  onCurrentDocumentChanged,
  onRefresh,
  className
}) => {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [menu, setMenu] = useState<{
    x: number
    y: number
    target:
      | { kind: 'document'; entry: DuelDocumentEntry }
      | { kind: 'folder'; folder: DuelDocumentFolder }
      | { kind: 'blank' }
  } | null>(null)

  const query = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!tree) return null
    const filterEntries = (entries: DuelDocumentEntry[]): DuelDocumentEntry[] =>
      query
        ? entries.filter(
            (entry) =>
              entry.title.toLowerCase().includes(query) ||
              entry.categoryPath.toLowerCase().includes(query)
          )
        : entries
    const filterFolder = (folder: DuelDocumentFolder): DuelDocumentFolder | null => {
      const folders = folder.folders
        .map(filterFolder)
        .filter((item): item is DuelDocumentFolder => item !== null)
      const documents = filterEntries(folder.documents)
      if (folders.length === 0 && documents.length === 0 && query) return null
      return { ...folder, folders, documents }
    }
    const folders = tree.folders
      .map(filterFolder)
      .filter((item): item is DuelDocumentFolder => item !== null)
    const documents = filterEntries(tree.documents)
    return { ...tree, folders, documents }
  }, [tree, query])

  const toggleFolder = (path: string): void => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const createDocument = async (folderPath: string): Promise<void> => {
    const title = await promptDialog({
      title: '新建台本',
      placeholder: '台本标题',
      confirmText: '创建',
      validate: (value) => titleConflictMessage(tree, folderPath, value.trim() || '未命名对局')
    })
    if (title === null) return
    const trimmed = title.trim() || '未命名对局'
    const confirmed = await confirmDialog({
      title: '基于当前决斗盘创建台本',
      description: '当前盘面、步骤和台本文本会复制到新台本中。',
      confirmText: '创建',
      destructive: false,
      icon: 'info'
    })
    if (!confirmed) return
    await flushDuelDocumentAutosave()
    const document = structuredClone(await buildDuelDocument())
    document.state.title = trimmed
    const result = await window.api.createDuelDocument(folderPath, document)
    if (!result.success || !result.filePath) {
      await alertDialog(`新建台本失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    await onRefresh()
    onOpen(result.filePath)
  }

  const createFolder = async (parentPath: string): Promise<void> => {
    const name = await promptDialog({
      title: '新建分类',
      placeholder: '分类名称',
      confirmText: '创建'
    })
    if (name === null) return
    const result = await window.api.createDuelDocumentFolder(parentPath, name.trim() || '新分类')
    if (!result.success) {
      await alertDialog(`新建分类失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    await onRefresh()
  }

  const renameDocument = async (entry: DuelDocumentEntry): Promise<void> => {
    const title = await promptDialog({
      title: '重命名台本',
      placeholder: '台本标题',
      initialValue: entry.title,
      confirmText: '保存',
      validate: (value) => {
        const nextTitle = value.trim() || entry.title
        if (nextTitle === entry.title) return null
        return titleConflictMessage(tree, entry.categoryPath, nextTitle, entry.filePath)
      }
    })
    if (title === null) return
    if (entry.filePath === currentFilePath) await flushDuelDocumentAutosave()
    const result = await window.api.renameDuelDocument(entry.filePath, title)
    if (!result.success || !result.filePath) {
      await alertDialog(`重命名失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    if (entry.filePath === currentFilePath) onOpen(result.filePath)
    await onRefresh()
  }

  const deleteDocument = async (entry: DuelDocumentEntry): Promise<void> => {
    const ok = await confirmDialog({
      title: `删除台本《${entry.title}》`,
      description: '此操作会从磁盘删除该对局文档。',
      confirmText: '删除',
      destructive: true
    })
    if (!ok) return
    const result = await window.api.deleteDuelDocument(entry.filePath)
    if (!result.success) {
      await alertDialog(`删除失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    if (entry.filePath === currentFilePath) onCurrentDocumentChanged(null)
    await onRefresh()
  }

  const renameFolder = async (folder: DuelDocumentFolder): Promise<void> => {
    const name = await promptDialog({
      title: '重命名分类',
      placeholder: '分类名称',
      initialValue: folder.name,
      confirmText: '保存'
    })
    if (name === null) return
    const result = await window.api.renameDuelDocumentFolder(folder.path, name)
    if (!result.success) {
      await alertDialog(`重命名分类失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    await onRefresh()
  }

  const deleteFolder = async (folder: DuelDocumentFolder): Promise<void> => {
    const ok = await confirmDialog({
      title: `删除分类「${folder.name}」`,
      description: '此操作会删除该分类及其中所有台本，无法恢复。',
      confirmText: '删除',
      destructive: true
    })
    if (!ok) return
    const result = await window.api.deleteDuelDocumentFolder(folder.path)
    if (!result.success) {
      await alertDialog(`删除分类失败\n\n${result.error ?? '未知错误'}`)
      return
    }
    if (currentFilePath) {
      const current = await window.api.readDuelDocument(currentFilePath)
      if (!current.success) onCurrentDocumentChanged(null)
    }
    await onRefresh()
  }

  const openDocumentMenu = (event: React.MouseEvent, entry: DuelDocumentEntry): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, target: { kind: 'document', entry } })
  }

  const openFolderMenu = (event: React.MouseEvent, folder: DuelDocumentFolder): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, target: { kind: 'folder', folder } })
  }

  const openBlankMenu = (event: React.MouseEvent): void => {
    if ((event.target as HTMLElement).closest('[data-library-row]')) return
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, target: { kind: 'blank' } })
  }

  const renderDocument = (entry: DuelDocumentEntry, indent: number): React.JSX.Element => {
    const active = entry.filePath === currentFilePath
    return (
      <div
        key={entry.filePath}
        data-library-row
        role="button"
        tabIndex={0}
        onClick={() => onOpen(entry.filePath)}
        onContextMenu={(event) => openDocumentMenu(event, entry)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') onOpen(entry.filePath)
        }}
        style={{ paddingLeft: 6 + indent }}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors',
          active
            ? 'bg-foreground/10 text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate">{entry.title}</span>
        <StepProvenanceBadge provenance={entry} />
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/60">
          {formatTime(entry.updatedAt)}
        </span>
      </div>
    )
  }

  const renderFolder = (folder: DuelDocumentFolder, depth: number): React.JSX.Element => {
    const isCollapsed = collapsed.has(folder.path) && !query
    return (
      <div key={folder.path}>
        <div
          data-library-row
          className="group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-muted/50"
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => toggleFolder(folder.path)}
          onContextMenu={(event) => openFolderMenu(event, folder)}
        >
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation()
              toggleFolder(folder.path)
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {isCollapsed ? (
            <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
          )}
          <span className="truncate">{folder.name}</span>
        </div>
        {!isCollapsed && (
          <div>
            {folder.folders.map((child) => renderFolder(child, depth + 1))}
            {folder.documents.map((entry) => renderDocument(entry, depth * 12 + 20))}
          </div>
        )}
      </div>
    )
  }

  const buildContextItems = (
    target:
      | { kind: 'document'; entry: DuelDocumentEntry }
      | { kind: 'folder'; folder: DuelDocumentFolder }
      | { kind: 'blank' }
  ): ContextMenuItem[] => {
    if (target.kind === 'blank') {
      return [{ label: '新建分类', onSelect: () => void createFolder('') }]
    }
    if (target.kind === 'document') {
      return [
        { label: '打开', onSelect: () => onOpen(target.entry.filePath) },
        { label: '重命名', onSelect: () => void renameDocument(target.entry) },
        {
          label: '删除',
          destructive: true,
          onSelect: () => void deleteDocument(target.entry)
        }
      ]
    }
    return [
      { label: '新建台本', onSelect: () => void createDocument(target.folder.path) },
      { label: '新建子分类', onSelect: () => void createFolder(target.folder.path) },
      { label: '重命名分类', onSelect: () => void renameFolder(target.folder) },
      {
        label: '删除分类',
        destructive: true,
        onSelect: () => void deleteFolder(target.folder)
      }
    ]
  }

  return (
    <div
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-border bg-card/40 select-none',
        className
      )}
    >
      <div className="flex h-9 shrink-0 items-center border-b border-border/70 px-2.5">
        <span className="text-xs font-semibold tracking-wide">台本库</span>
      </div>

      <div className="shrink-0 border-b border-border/60 p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索台本或分类"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" onContextMenu={openBlankMenu}>
        {!filtered ? (
          <div className="flex h-full min-h-[240px] items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
            正在读取台本库…
          </div>
        ) : filtered.folders.length === 0 && filtered.documents.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-1 p-6 text-center text-[11px] text-muted-foreground">
            <Folder className="h-8 w-8 opacity-30" />
            <span>{query ? '没有匹配的台本' : '还没有台本'}</span>
          </div>
        ) : (
          <>
            {filtered.folders.map((folder) => renderFolder(folder, 0))}
            {filtered.documents.map((entry) => renderDocument(entry, 0))}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={buildContextItems(menu.target)}
        />
      )}
    </div>
  )
}
