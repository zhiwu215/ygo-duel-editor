import React, { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { DuelType, DuelPuzzleState } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { cn } from '../../../lib/utils'

interface SaveProjectModalProps {
  open: boolean
  onClose: () => void
}

interface DuelTypeOption {
  value: DuelType
  label: string
}

const DUEL_TYPE_OPTIONS: DuelTypeOption[] = [
  { value: 'full', label: '整局' },
  { value: 'puzzle', label: '残局' },
  { value: 'combo', label: 'Combo' }
]

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ open, onClose }) => {
  const { state, setTitle, setHint, setDuelType } = useDuelStore()

  const [localTitle, setLocalTitle] = useState(() => state.title || '未命名对局')
  const [localHint, setLocalHint] = useState(() => state.hint || '')
  const [localType, setLocalType] = useState<DuelType>(() => state.duelType || 'full')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleConfirmSave = async (): Promise<void> => {
    if (isSaving) return

    const trimmedTitle = localTitle.trim() || '未命名对局'
    const trimmedHint = localHint.trim()

    setTitle(trimmedTitle)
    setHint(trimmedHint)
    setDuelType(localType)

    const stateToSave: DuelPuzzleState = {
      ...state,
      title: trimmedTitle,
      hint: trimmedHint,
      duelType: localType
    }

    setIsSaving(true)
    try {
      const res = await window.api.saveProjectFile(stateToSave)
      if (res.success && res.filePath) {
        onClose()
        alert(`工程已成功保存：\n${res.filePath}`)
      } else {
        onClose()
      }
    } catch (err) {
      console.error('[SaveProjectModal] 保存工程失败:', err)
      alert('保存工程失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose()
      }}
    >
      <div className="relative w-full max-w-md bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4.5 select-none animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">保存决斗工程</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-muted/80 transition-colors disabled:opacity-50"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">工程分类</label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/70">
            {DUEL_TYPE_OPTIONS.map((opt) => {
              const isSelected = localType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLocalType(opt.value)}
                  className={cn(
                    'flex items-center justify-center py-2 px-1.5 rounded-md transition-all text-center',
                    isSelected
                      ? 'bg-background text-foreground shadow-xs border border-border font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
                  )}
                >
                  <span className="text-xs leading-none">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="save-project-title" className="text-xs font-medium text-foreground">
            工程名称
          </label>
          <Input
            id="save-project-title"
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirmSave()
              }
            }}
            placeholder="例如：俱舍怒威族一卡做场教学 / 暗游戏决战海马"
            disabled={isSaving}
            className="h-8 text-xs bg-background/60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="save-project-hint" className="text-xs font-medium text-foreground">
            注释
          </label>
          <textarea
            id="save-project-hint"
            value={localHint}
            onChange={(e) => setLocalHint(e.target.value)}
            rows={4}
            disabled={isSaving}
            className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[88px] max-h-[200px] leading-relaxed transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 text-xs px-3"
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmSave}
            disabled={isSaving}
            className="h-8 text-xs px-4 gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? '正在保存...' : '保存工程'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
