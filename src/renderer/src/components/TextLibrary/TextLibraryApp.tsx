import React, { useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search, Upload } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { TextMeta } from '@shared/index'
import { WindowControls } from '../ui/window-controls'
import { Input } from '../ui/input'
import { useTextLibrary } from '../../hooks/useTextLibrary'
import { LibraryGrid } from './LibraryGrid'
import { ChapterReader } from './ChapterReader'

export const TextLibraryApp: React.FC = () => {
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
  } = useTextLibrary({
    tag: 'TextLibraryApp',
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
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <header className="shrink-0 border-b border-border/60 [-webkit-app-region:drag]">
        <div className="flex items-center gap-3 px-4 h-11">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-sm">文本素材库</span>
          </div>
          <div className="flex-1" />
          <div className="[-webkit-app-region:no-drag] flex items-center gap-2 -mr-3">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer"
                  >
                    <RefreshCw className={cnRefresh(loading)} />
                  </button>
                }
              />
              <TooltipContent>刷新列表</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => void importText()}
                    disabled={importing}

                    className="flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>导入文本</span>
                  </button>
                }
              />
              <TooltipContent>导入本地文本文件（txt / md / epub），自动按章节拆分</TooltipContent>
            </Tooltip>
            <WindowControls />
          </div>
        </div>
      </header>

      <div className="shrink-0 px-4 py-2.5 border-b border-border/60">
        <div className="relative max-w-md [-webkit-app-region:no-drag]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文本"
            className="h-8 pl-8 text-xs bg-muted/40"
          />
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-1.5 bg-destructive/10 border-b border-destructive/30 text-destructive text-[11px]">
          {error}
        </div>
      )}
      {feedback && (
        <div className="shrink-0 px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-500 text-[11px]">
          {feedback}
        </div>
      )}

      <LibraryGrid
        texts={filtered}
        loading={loading}
        search={search}
        onOpen={setOpenText}
        onDelete={(n) => void removeText(n)}
        onResplit={(n) => void resplitText(n)}
        onImport={() => void importText()}
      />
    </div>
  )
}

function cnRefresh(loading: boolean): string {
  return loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'
}
