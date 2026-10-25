import React from 'react'
import { BookOpen, Download, Loader2, Save, Trash2 } from 'lucide-react'
import { TextLibraryEntry } from '@shared/index'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'

interface TextReaderProps {
  entry: TextLibraryEntry | null
  content: string | null
  loading: boolean
  dirty: boolean
  saving: boolean
  hasEntries: boolean
  onChange: (text: string) => void
  onSave: () => void
  onExport: (entry: TextLibraryEntry) => void
  onDelete: (entry: TextLibraryEntry) => void
}

function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export const TextReader: React.FC<TextReaderProps> = ({
  entry,
  content,
  loading,
  dirty,
  saving,
  hasEntries,
  onChange,
  onSave,
  onExport,
  onDelete
}) => {
  if (!entry) {
    return (
      <section className="flex min-w-0 flex-1 items-center justify-center px-10">
        <div className="flex max-w-md flex-col items-center text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
          {hasEntries ? (
            <>
              <p className="text-xs font-semibold">从左侧选择一篇文本</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                点击分类中的标题，即可查看和修改导出的台本文本。
              </p>
            </>
          ) : (
            <p className="text-xs font-semibold">从台本导出的文本会出现在这里</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{entry.title}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-muted-foreground">
            <span className="truncate">
              {entry.categoryPath ? entry.categoryPath.replace(/\//g, ' / ') : '未分类'}
            </span>
            <span className="opacity-50">·</span>
            <span className="shrink-0">约 {entry.wordCount.toLocaleString('zh-CN')} 字</span>
            <span className="opacity-50">·</span>
            <span className="shrink-0">{formatUpdatedAt(entry.updatedAt)}</span>
          </p>
        </div>
        {dirty && <span className="shrink-0 text-[10px] text-amber-500">未保存</span>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
          className="h-7 gap-1.5 text-xs"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => onExport(entry)}
          disabled={saving}
          className="h-7 gap-1.5 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          导出文本
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(entry)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <Textarea
            key={entry.path}
            value={content ?? ''}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault()
                onSave()
              }
            }}
            spellCheck={false}
            placeholder="台本文本内容"
            style={{ fontSize: 'var(--content-font-size)' }}
            className="h-full resize-none rounded-none border-0 bg-transparent px-6 py-4 leading-[1.9] shadow-none outline-none focus-visible:ring-0"
          />
        </div>
      )}
    </section>
  )
}
