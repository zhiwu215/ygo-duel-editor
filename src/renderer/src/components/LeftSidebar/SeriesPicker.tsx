import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Inbox, Library, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'

const PANEL_WIDTH = 208
const PANEL_MAX_HEIGHT = 264

interface SeriesPickerProps {
  anchor: DOMRect
  seriesList: string[]
  current: string
  onPick: (series: string | null) => void
  onCreate: (name: string) => Promise<string | null>
  onClose: () => void
}

/**
 * 把某个对局归入作品分类的浮层
 *
 * 侧栏是 overflow 滚动容器，浮层用 portal + fixed 挂到 body，避免被裁切。
 */
export const SeriesPicker: React.FC<SeriesPickerProps> = ({
  anchor,
  seriesList,
  current,
  onPick,
  onCreate,
  onClose
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 4 })

  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight || PANEL_MAX_HEIGHT
    const overflowBottom = anchor.bottom + 4 + height > window.innerHeight - 8
    const top = overflowBottom ? Math.max(8, anchor.top - height - 4) : anchor.bottom + 4
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - PANEL_WIDTH - 8)
    setPos({ left, top })
  }, [anchor])

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (!panelRef.current?.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const submitCreate = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await onCreate(draft)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onPick(draft.trim())
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ left: pos.left, top: pos.top, width: PANEL_WIDTH }}
      className="fixed z-[95] bg-popover text-popover-foreground border border-border rounded-lg shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <div className="px-2 py-1.5 border-b border-border/60 text-[10px] font-semibold text-muted-foreground tracking-wide">
        归入作品分类
      </div>

      <ScrollArea style={{ maxHeight: 168 }}>
        <div className="p-1 flex flex-col gap-0.5">
          {seriesList.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-muted-foreground/80 leading-relaxed">
              还没有作品分类，在下方新建一个
            </p>
          ) : (
            seriesList.map((name) => {
              const isCurrent = name === current
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onPick(name)}
                  className={cn(
                    'flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-left transition-colors',
                    isCurrent
                      ? 'bg-accent/60 text-foreground font-medium'
                      : 'text-foreground/85 hover:bg-muted'
                  )}
                >
                  <Library className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{name}</span>
                  {isCurrent && <Check className="w-3 h-3 text-primary shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>

      {current && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border-t border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Inbox className="w-3 h-3 shrink-0" />
          <span>移出分类（归入未归类）</span>
        </button>
      )}

      <div className="p-1.5 border-t border-border/60 flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submitCreate()
            }
          }}
          placeholder="新建分类…"
          className="flex-1 min-w-0 h-6 px-1.5 text-[11px] rounded border border-input bg-background/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={busy || !draft.trim()}
                className="h-6 w-6 shrink-0 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            }
          />
          <TooltipContent>新建并归入</TooltipContent>
        </Tooltip>
      </div>

      {error && (
        <p className="px-2.5 pb-1.5 text-[10px] text-destructive leading-relaxed">{error}</p>
      )}
    </div>,
    document.body
  )
}
