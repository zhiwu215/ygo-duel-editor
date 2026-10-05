import React, { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { FolderPlus, Pencil, X } from 'lucide-react'

interface GroupNameModalProps {
  /** 传入分组名 = 重命名；传null = 新建 */
  initialName: string | null
  /** 已存在的分组名，重名校验时用来挡重名 */
  existingGroups: string[]
  onConfirm: (name: string) => Promise<boolean>
  onClose: () => void
}

/**
 * 分组新建 / 重命名弹窗
 *
 * 用模态而不是分组栏内联输入：内联框会挤在标签流里（新建时排在最右、
 * 改名时插在原位），用户视线要来回找；且分组栏本身横向滚动，
 * 输入框在滚动容器里会被裁切。模态居中固定，位置可预期。
 */
export const GroupNameModal: React.FC<GroupNameModalProps> = ({
  initialName,
  existingGroups,
  onConfirm,
  onClose
}) => {
  const isRename = initialName !== null
  const [name, setName] = useState<string>(initialName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 打开即全选已有名字：重命名时直接打字覆盖，比手动清空快
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
    if (isRename && trimmed === initialName) {
      onClose()
      return
    }
    if (existingGroups.includes(trimmed)) {
      setError('已存在同名分组')
      return
    }

    setIsSubmitting(true)
    const ok = await onConfirm(trimmed)
    setIsSubmitting(false)
    // 失败时保持打开，让用户改名字而不是重新来一遍
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
            <span className="font-bold text-sm">{isRename ? '重命名分组' : '新建分组'}</span>
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
          <span className="text-xs font-semibold text-muted-foreground">分组名</span>
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
          {error ? (
            <span className="text-[11px] text-destructive">{error}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground leading-4">
              分组可先建空组，之后再往里归类卡组。
            </span>
          )}
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
