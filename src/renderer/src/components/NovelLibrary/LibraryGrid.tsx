import React from 'react'
import { FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { NovelMeta } from '@shared/index'

interface LibraryGridProps {
  novels: NovelMeta[]
  loading: boolean
  search: string
  onOpen: (novel: NovelMeta) => void
  onDelete: (novel: NovelMeta) => void
  onResplit: (novel: NovelMeta) => void
  onImport: () => void
}

export const LibraryGrid: React.FC<LibraryGridProps> = ({
  novels,
  loading,
  search,
  onOpen,
  onDelete,
  onResplit,
  onImport
}) => {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (novels.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-xs font-semibold">{search ? '没有匹配的小说' : '素材库还是空的'}</p>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed max-w-sm">
          {search
            ? '换个关键词试试'
            : '支持 txt / md / epub。导入后会按章节拆分存档到本地，只需导入一次，之后随时回来挑选章节编排对局。'}
        </p>
        {!search && (
          <button
            type="button"
            onClick={onImport}
            className="mt-4 flex items-center gap-1.5 px-3 h-8 rounded-md border border-border text-xs font-medium hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>导入小说</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-x-3 gap-y-5 content-start">
        {novels.map((novel) => (
          <div key={novel.id} className="group flex flex-col items-center gap-1.5">
            <div className="relative w-full flex justify-center">
              <button
                type="button"
                onDoubleClick={() => onOpen(novel)}
                onClick={() => onOpen(novel)}
                title={`${novel.title}${novel.chapterCount ? ` · ${novel.chapterCount} 章` : ''}`}
                className="w-full flex flex-col items-center gap-2 rounded-md px-1 py-2 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <FileText
                  className="w-11 h-11 text-foreground/75 group-hover:text-foreground transition-colors shrink-0"
                  strokeWidth={1.25}
                />
                <span className="w-full text-[11px] leading-tight text-center break-words line-clamp-3 px-0.5">
                  {novel.title}
                </span>
              </button>
              <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  title="重新按章节拆分"
                  onClick={(e) => {
                    e.stopPropagation()
                    onResplit(novel)
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(novel)
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              {novel.chapterCount ? (
                <span>{novel.chapterCount} 章</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">未拆分</span>
              )}
              <span className="opacity-60">·</span>
              <span>{(novel.wordCount || 0).toLocaleString()} 字</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
