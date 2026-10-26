import { useLayoutEffect, useRef, useState, type JSX } from 'react'
import { Check, Plus, StarOff } from 'lucide-react'
import type { CdbCard } from '@shared/index'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { promptDialog } from '../../stores/useDialogStore'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { cn } from '../../lib/utils'

interface FavoriteCategoryPopoverProps {
  card: CdbCard
  anchor: { x: number; y: number }
  onClose: () => void
}

export function FavoriteCategoryPopover({
  card,
  anchor,
  onClose
}: FavoriteCategoryPopoverProps): JSX.Element {
  const categories = useFavoritesStore((s) => s.categories)
  const categorySets = useFavoritesStore((s) => s.categorySets)
  const ungrouped = useFavoritesStore((s) => s.isUngrouped(card.id))
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const setUngrouped = useFavoritesStore((s) => s.setUngrouped)
  const setCategoryMembership = useFavoritesStore((s) => s.setCategoryMembership)
  const addCategory = useFavoritesStore((s) => s.addCategory)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(anchor)

  useDismissOnOutside(ref, true, onClose)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: Math.max(8, Math.min(anchor.x, window.innerWidth - width - 12)),
      y: Math.max(8, Math.min(anchor.y, window.innerHeight - height - 12))
    })
  }, [anchor])

  const createCategory = async (): Promise<void> => {
    const name = await promptDialog({
      title: '新建收藏分类',
      placeholder: '分类名称',
      confirmText: '创建'
    })
    const trimmed = name?.trim()
    if (!trimmed) return
    const id = await addCategory(trimmed)
    if (!id) return
    void setCategoryMembership(card.id, id, true)
  }

  const selectUngrouped = (): void => {
    if (!ungrouped) void setUngrouped(card.id)
  }

  const removeFavorite = async (): Promise<void> => {
    await toggleFavorite(card.id)
    onClose()
  }

  const rowClass =
    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 cursor-pointer'

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[70] w-52 space-y-0.5 rounded-lg border border-border bg-popover/95 p-1.5 text-xs text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-75 select-none"
    >
      <button type="button" onClick={selectUngrouped} className={rowClass}>
        <Check className={cn('h-3.5 w-3.5 shrink-0', ungrouped ? 'text-amber-400' : 'opacity-0')} />
        <span className="truncate">未分类</span>
      </button>

      {categories.map((category) => {
        const member = categorySets.get(category.id)?.has(card.id) ?? false
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => void setCategoryMembership(card.id, category.id, !member)}
            className={rowClass}
          >
            <Check
              className={cn('h-3.5 w-3.5 shrink-0', member ? 'text-amber-400' : 'opacity-0')}
            />
            <span className="truncate">{category.name}</span>
          </button>
        )
      })}

      <div className="my-1 h-px bg-border" />

      <button type="button" onClick={() => void createCategory()} className={rowClass}>
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>新建分类…</span>
      </button>

      <p className="px-2 pb-0.5 pt-1 text-[9px] leading-tight text-muted-foreground/80">
        点击分类即可加入或移出，可同时属于多个分类
      </p>

      <div className="my-1 h-px bg-border" />

      <button
        type="button"
        onClick={() => void removeFavorite()}
        className={cn(rowClass, 'text-destructive hover:bg-destructive/10')}
      >
        <StarOff className="h-3.5 w-3.5 shrink-0" />
        <span>取消收藏</span>
      </button>
    </div>
  )
}
