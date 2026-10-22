import React from 'react'
import { Check, Copy, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CardNote, CardNoteKind } from '@shared/index'
import { buildSortId } from '../../utils/cardNoteSort'

interface SortableNoteRowProps {
  kind: CardNoteKind
  item: CardNote
  copyKey: string
  copiedField: string | null
  onCopy: (field: string, text: string) => Promise<void>
  onEdit: () => void
  onDelete: () => void
}

export function SortableNoteRow({
  kind,
  item,
  copyKey,
  copiedField,
  onCopy,
  onEdit,
  onDelete
}: SortableNoteRowProps): React.JSX.Element {
  const draggable = !item.readonly
  const id = buildSortId(kind, item.title)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable
  })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded border border-border/70 bg-background/40 px-2.5 py-2 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40 z-10' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {draggable && (
          <span aria-hidden="true" className="shrink-0 text-muted-foreground/40 -ml-0.5">
            <GripVertical className="w-3 h-3" />
          </span>
        )}
        <span
          className={`text-[10px] font-semibold ${
            kind === 'chant' ? 'text-foreground' : 'text-foreground/80'
          } truncate flex-1`}
        >
          {item.title}
        </span>
        {item.readonly ? (
          <span className="shrink-0 text-[9px] px-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
            内置
          </span>
        ) : kind === 'chant' ? (
          item.source ? (
            <span className="shrink-0 max-w-40 truncate text-[9px] px-1 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25">
              {`借鉴：${item.source}`}
            </span>
          ) : (
            <span className="shrink-0 text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              原创
            </span>
          )
        ) : null}
        <button
          type="button"
          onClick={() => void onCopy(copyKey, item.text)}
          className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
        >
          {copiedField === copyKey ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        {!item.readonly && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      <p
        style={{ fontSize: 'var(--content-font-size)' }}
        className="text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1"
      >
        {item.text}
      </p>
      {kind === 'chant' && (item.user || item.source) && (
        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-relaxed">
          {item.user && (
            <span>
              使用者：<span className="text-foreground/80">{item.user}</span>
            </span>
          )}
          {item.user && item.source && <span className="mx-1.5">·</span>}
          {item.source && <span>出自：{item.source}</span>}
        </p>
      )}
    </div>
  )
}
