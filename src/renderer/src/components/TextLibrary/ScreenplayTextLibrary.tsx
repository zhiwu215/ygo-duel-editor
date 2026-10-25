import React, { useMemo, useState } from 'react'
import { useTextLibrary } from '../../hooks/useTextLibrary'
import { countTextLibraryEntries, filterTextLibraryTree } from '../../utils/textLibraryTree'
import { TextLibrarySidebar } from './TextLibrarySidebar'
import { TextReader } from './TextReader'

export const ScreenplayTextLibrary: React.FC = () => {
  const [search, setSearch] = useState('')
  const {
    tree,
    loading,
    refreshing,
    error,
    feedback,
    selected,
    content,
    contentLoading,
    dirty,
    saving,
    refresh,
    select,
    updateContent,
    saveContent,
    removeEntry,
    removeFolder,
    exportEntry
  } = useTextLibrary()

  const filtered = useMemo(
    () => (tree ? filterTextLibraryTree(tree, search) : null),
    [tree, search]
  )
  const hasEntries = tree ? countTextLibraryEntries(tree) > 0 : false

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {error && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      )}
      {feedback && (
        <div className="shrink-0 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[11px] text-emerald-500">
          {feedback}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <TextLibrarySidebar
          tree={filtered}
          loading={loading}
          refreshing={refreshing}
          search={search}
          selectedPath={selected?.path ?? null}
          onSearchChange={setSearch}
          onSelect={(entry) => void select(entry)}
          onDelete={(entry) => void removeEntry(entry)}
          onDeleteFolder={(folder) => void removeFolder(folder)}
          onRefresh={() => void refresh()}
        />
        <TextReader
          entry={selected}
          content={content}
          loading={contentLoading}
          dirty={dirty}
          saving={saving}
          hasEntries={hasEntries}
          onChange={updateContent}
          onSave={() => void saveContent()}
          onExport={(entry) => void exportEntry(entry)}
          onDelete={(entry) => void removeEntry(entry)}
        />
      </div>
    </div>
  )
}
