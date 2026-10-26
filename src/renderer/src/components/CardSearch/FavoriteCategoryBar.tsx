import { useEffect, useState, type JSX } from 'react'
import type { FavoriteCategory } from '@shared/index'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { confirmDialog, promptDialog } from '../../stores/useDialogStore'
import { ContextMenu } from '../ui/ContextMenu'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select'

const UNGROUPED_VALUE = '__ungrouped__'

export function FavoriteCategoryBar(): JSX.Element {
  const categories = useFavoritesStore((s) => s.categories)
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

  const currentCategory = categories.find((category) => category.id === favoriteCategoryId) ?? null

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

  const openManageMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (!currentCategory) return
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({
      x: rect.left,
      y: rect.bottom + 4,
      category: currentCategory
    })
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
      description: '删除分类会移除其中的卡片，不会回到「未分类」；同时属于其他分类的卡片会保留。',
      confirmText: '删除',
      destructive: true
    })
    if (!ok) return
    await deleteCategory(category.id)
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/10 px-2 py-1.5">
      <Select
        value={favoriteCategoryId ?? UNGROUPED_VALUE}
        onValueChange={(value) =>
          setFilters({ favoriteCategoryId: value === UNGROUPED_VALUE ? null : value })
        }
      >
        <SelectTrigger size="sm" className="h-6 w-44 bg-background/60 text-[11px]">
          <span className="min-w-0 flex-1 truncate text-left">
            {currentCategory?.name ?? '未分类'}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNGROUPED_VALUE}>未分类</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => void createCategory()}
        className="shrink-0 rounded border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-amber-500 hover:text-amber-500"
      >
        新建分类
      </button>

      {currentCategory && (
        <button
          type="button"
          onClick={openManageMenu}
          className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          管理
        </button>
      )}

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
