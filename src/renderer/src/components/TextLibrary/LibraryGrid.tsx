import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React from 'react'
import { FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { TextMeta } from '@shared/index'

interface LibraryGridProps {
  texts: TextMeta[]
  loading: boolean
  search: string
  onOpen: (text: TextMeta) => void
  onDelete: (text: TextMeta) => void
  onResplit: (text: TextMeta) => void
  onImport: () => void
}

export const LibraryGrid: React.FC<LibraryGridProps> = ({
  texts,
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

  if (texts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-xs font-semibold">{search ? '没有匹配的文本' : '素材库还是空的'}</p>
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
            <span>导入文本</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-4 py-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-x-3 gap-y-5 content-start">
          {texts.map((text) => (
            <div key={text.id} className="group flex flex-col items-center gap-1.5">
              <div className="relative w-full flex justify-center">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onDoubleClick={() => onOpen(text)}
                        onClick={() => onOpen(text)}
                        className="w-full flex flex-col items-center gap-2 rounded-md px-1 py-2 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <FileText
                          className="w-11 h-11 text-foreground/75 group-hover:text-foreground transition-colors shrink-0"
                          strokeWidth={1.25}
                        />
                        <span className="w-full text-[11px] leading-tight text-center break-words line-clamp-3 px-0.5">
                          {text.title}
                        </span>
                      </button>
                    }
                  />
                  <TooltipContent>{`${text.title}${text.chapterCount ? ` · ${text.chapterCount} 章` : ''}`}</TooltipContent>
                </Tooltip>
                <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onResplit(text)
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      }
                    />
                    <TooltipContent>重新按章节拆分</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(text)
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      }
                    />
                    <TooltipContent>删除</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                {text.chapterCount ? (
                  <span>{text.chapterCount} 章</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">未拆分</span>
                )}
                <span className="opacity-60">·</span>
                <span>{(text.wordCount || 0).toLocaleString()} 字</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
