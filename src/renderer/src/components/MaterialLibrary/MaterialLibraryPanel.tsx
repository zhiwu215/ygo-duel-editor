import React, { useMemo, useState } from 'react'
import { Download, Loader2, RefreshCw, Search } from 'lucide-react'
import { TextMeta } from '@shared/index'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useMaterialLibrary } from '../../hooks/useMaterialLibrary'
import { LibraryGrid } from './LibraryGrid'
import { ChapterReader } from './ChapterReader'
import { cn } from '../../lib/utils'

export const MaterialLibraryPanel: React.FC = () => {
  const [search, setSearch] = useState('')
  const [openText, setOpenText] = useState<TextMeta | null>(null)

  const {
    texts,
    loading,
    busy: importing,
    feedback,
    error,
    flash,
    refresh,
    importText,
    removeText,
    resplitText
  } = useMaterialLibrary({
    tag: 'MaterialLibraryPanel',
    activeId: openText?.id ?? null,
    onActiveReplaced: (text) => setOpenText(text)
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return texts
    return texts.filter((n) => n.title.toLowerCase().includes(q))
  }, [texts, search])

  if (openText) {
    return (
      <ChapterReader
        text={openText}
        onBack={async () => {
          setOpenText(null)
          await refresh()
        }}
        onTextUpdated={refresh}
        flash={flash}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void importText()}
          disabled={importing}
          className="h-7 gap-1.5 text-xs"
        >
          {importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          导入文本
        </Button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索文本"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

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

      <LibraryGrid
        texts={filtered}
        loading={loading}
        search={search}
        onOpen={setOpenText}
        onDelete={(text) => void removeText(text)}
        onResplit={(text) => void resplitText(text)}
        onImport={() => void importText()}
      />
    </div>
  )
}
