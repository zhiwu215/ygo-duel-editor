import { useEffect, useState, type JSX } from 'react'
import type { FavoriteCategory } from '@shared/index'
import { useFavoritesStore } from '../../stores/useFavoritesStore'
import { confirmDialog, promptDialog } from '../../stores/useDialogStore'
import { ContextMenu } from '../ui/ContextMenu'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select'
import { cn } from '../../lib/utils'

const UNGROUPED_VALUE = '__ungrouped__'

interface FavoriteCategoryBarProps {
  categoryId: string | null
  onCategoryChange: (id: string | null) => void
  className?: string
}

export function FavoriteCategoryBar({
  categoryId,
  onCategoryChange,
  className
}: FavoriteCategoryBarProps): JSX.Element {
  const categories = useFavoritesStore((s) => s.categories)
  const addCategory = useFavoritesStore((s) => s.addCategory)
  const renameCategory = useFavoritesStore((s) => s.renameCategory)
  const deleteCategory = useFavoritesStore((s) => s.deleteCategory)
  const [menu, setMenu] = useState<{
    x: number
    y: number
    category: FavoriteCategory
  } | null>(null)

  const currentCategory = categories.find((category) => category.id === categoryId) ?? null

  useEffect(() => {
    if (!categoryId) return
    if (categories.some((category) => category.id === categoryId)) return
    onCategoryChange(null)
  }, [categories, categoryId, onCategoryChange])

  const createCategory = async (): Promise<void> => {
    const name = await promptDialog({
      title: '新建收藏分类',
      placeholder: '分类名称',
      confirmText: '创建'
    })
    const trimmed = name?.trim()
    if (!trimmed) return
    const id = await addCategory(trimmed)
    if (id) onCategoryChange(id)
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
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border/40 bg-muted/10 px-2 py-1.5',
        className
      )}
    >
      <Select
        value={categoryId ?? UNGROUPED_VALUE}
        onValueChange={(value) => onCategoryChange(value === UNGROUPED_VALUE ? null : value)}
      >
        <SelectTrigger size="sm" className="h-6 min-w-0 flex-1 bg-background/60 text-[11px]">
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
