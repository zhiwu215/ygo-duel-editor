import { useEffect, useState, type JSX } from 'react'
import { Plus } from 'lucide-react'
import type { FavoriteCategory } from '@shared/index'
import { isInAnyCategory, useFavoritesStore } from '../../stores/useFavoritesStore'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { confirmDialog, promptDialog } from '../../stores/useDialogStore'
import { ContextMenu } from '../ui/ContextMenu'
import { cn } from '../../lib/utils'

function chipClass(active: boolean): string {
  return cn(
    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer',
    active
      ? 'border-amber-500 bg-amber-500 text-neutral-950'
      : 'border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground'
  )
}

export function FavoriteCategoryBar(): JSX.Element {
  const categories = useFavoritesStore((s) => s.categories)
  const favorites = useFavoritesStore((s) => s.favorites)
  const categorySets = useFavoritesStore((s) => s.categorySets)
  const ungroupedCount = favorites.filter((code) => !isInAnyCategory(categorySets, code)).length
  const addCategory = useFavoritesStore((s) => s.addCategory)
  const renameCategory = useFavoritesStore((s) => s.renameCategory)
  const deleteCategory = useFavoritesStore((s) => s.deleteCategory)
  const favoriteCategoryId = useCardSearchStore((s) => s.favoriteCategoryId)
  const setFilters = useCardSearchStore((s) => s.setFilters)
  const [menu, setMenu] = useState<{
    x: number
    y: number
    category: FavoriteCategory
  } | null>(null)

  useEffect(() => {
    if (!favoriteCategoryId) return
    if (categories.some((category) => category.id === favoriteCategoryId)) return
    setFilters({ favoriteCategoryId: null })
  }, [categories, favoriteCategoryId, setFilters])

  const createCategory = async (): Promise<void> => {
    const name = await promptDialog({
      title: '新建收藏分类',
      placeholder: '分类名称',
      confirmText: '创建'
    })
    const trimmed = name?.trim()
    if (!trimmed) return
    const id = await addCategory(trimmed)
    if (id) setFilters({ favoriteCategoryId: id })
  }

  const renameCategoryPrompt = async (category: FavoriteCategory): Promise<void> => {
    setMenu(null)
    const name = await promptDialog({
      title: '重命名收藏分类',
      placeholder: '分类名称',
      initialValue: category.name,
      confirmText: '保存'
    })
    const trimmed = name?.trim()
    if (!trimmed || trimmed === category.name) return
    await renameCategory(category.id, trimmed)
  }

  const deleteCategoryPrompt = async (category: FavoriteCategory): Promise<void> => {
    setMenu(null)
    const ok = await confirmDialog({
      title: `删除分类「${category.name}」`,
      description: '删除分类会移除其中的卡片，不会回到「未分组」；同时属于其他分类的卡片会保留。',
      confirmText: '删除',
      destructive: true
    })
    if (!ok) return
    await deleteCategory(category.id)
  }

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/40 bg-muted/10 px-2 py-1.5">
      <button
        type="button"
        onClick={() => setFilters({ favoriteCategoryId: null })}
        className={chipClass(favoriteCategoryId === null)}
      >
        未分组
        {ungroupedCount > 0 && <span className="ml-1 font-mono opacity-70">{ungroupedCount}</span>}
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => setFilters({ favoriteCategoryId: category.id })}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, category })
          }}
          className={chipClass(favoriteCategoryId === category.id)}
        >
          {category.name}
          <span className="ml-1 font-mono opacity-70">{category.cards.length}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => void createCategory()}
        className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-amber-500 hover:text-amber-500"
      >
        <Plus className="h-3 w-3" />
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: '重命名', onSelect: () => void renameCategoryPrompt(menu.category) },
            {
              label: '删除分类',
              destructive: true,
              onSelect: () => void deleteCategoryPrompt(menu.category)
            }
          ]}
        />
      )}
    </div>
  )
}
