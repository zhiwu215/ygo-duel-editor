import React, { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { TextChapter } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'

interface ChapterPickerProps {
  chapters: TextChapter[]
  busy: boolean
  onSend: (picked: TextChapter[]) => void
}

export function ChapterPicker({ chapters, busy, onSend }: ChapterPickerProps): React.JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(chapters.map((c) => c.id)))
  const chapterKey = chapters.map((c) => c.id).join(',')
  const [lastChapterKey, setLastChapterKey] = useState(chapterKey)
  if (chapterKey !== lastChapterKey) {
    setLastChapterKey(chapterKey)
    setPicked(new Set(chapters.map((c) => c.id)))
  }

  if (chapters.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground mt-2 pl-4">
        未能从该文件拆出章节，可能是格式不受支持。
      </p>
    )
  }

  const toggle = (id: string): void => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-2 pl-4">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <button
          type="button"
          onClick={() =>
            setPicked((prev) =>
              prev.size === chapters.length ? new Set() : new Set(chapters.map((c) => c.id))
            )
          }
          className="hover:text-foreground transition-colors cursor-pointer"
        >
          {picked.size === chapters.length ? '全不选' : '全选'}
        </button>
        <span className="font-mono">
          已选 {picked.size}/{chapters.length}
        </span>
      </div>

      <ScrollArea className="max-h-52 mt-1">
        <div className="space-y-0.5 pr-1">
          {chapters.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
            >
              <Checkbox
                checked={picked.has(c.id)}
                onCheckedChange={() => toggle(c.id)}
                className="w-3 h-3 shrink-0"
              />
              <span className="truncate flex-1">{c.title}</span>
              <span className="font-mono opacity-70 shrink-0">
                {(c.wordCount || 0).toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>

      <Button
        size="xs"
        onClick={() => onSend(chapters.filter((c) => picked.has(c.id)))}
        disabled={picked.size === 0 || busy}
        className="w-full h-6 mt-1.5 text-[10px] gap-1"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        <span>{busy ? '编排中' : `把所选 ${picked.size} 章交给背后灵编排`}</span>
      </Button>
    </div>
  )
}
