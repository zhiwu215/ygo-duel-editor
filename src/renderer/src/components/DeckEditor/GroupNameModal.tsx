import React, { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { FolderPlus, Pencil, X } from 'lucide-react'
import { groupChildPath, groupLeafName } from '@shared/index'

interface GroupNameModalProps {
  initialName: string | null
  existingGroups: string[]
  parentPath?: string | null
  onConfirm: (name: string) => Promise<boolean>
  onClose: () => void
}

export const GroupNameModal: React.FC<GroupNameModalProps> = ({
  initialName,
  existingGroups,
  parentPath,
  onConfirm,
  onClose
}) => {
  const isRename = initialName !== null
  const [name, setName] = useState<string>(initialName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const parent = isRename ? null : (parentPath ?? null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleConfirm = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('分组名不能为空')
      return
    }
    if (trimmed.includes('/')) {
      setError('分组名不能包含 /')
      return
    }
    if (isRename && trimmed === initialName) {
      onClose()
      return
    }
    if (existingGroups.includes(groupChildPath(parent, trimmed))) {
      setError('已存在同名分组')
      return
    }

    setIsSubmitting(true)
    const ok = await onConfirm(trimmed)
    setIsSubmitting(false)

    if (ok) onClose()
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 max-w-sm w-full animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRename ? (
              <Pencil className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <FolderPlus className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="font-bold text-sm">
              {isRename ? '重命名分组' : parent ? '新建子分组' : '新建分组'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">分组名</span>
            {parent && (
              <span className="text-[11px] text-muted-foreground truncate">
                位置：{parent.split('/').map(groupLeafName).join(' / ')}
              </span>
            )}
          </div>
          <Input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleConfirm()
              }
            }}
            placeholder={isRename ? '输入新的分组名' : '如：暗之游戏'}
            className="h-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
          />
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-xs font-semibold"
          >
            取消
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="h-7 text-xs font-bold shadow-xs"
          >
            {isRename ? '保存' : '创建'}
          </Button>
        </div>
      </div>
    </div>
  )
}
