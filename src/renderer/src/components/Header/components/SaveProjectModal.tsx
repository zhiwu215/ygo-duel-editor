import React, { useState, useEffect, useRef } from 'react'
import { X, Save } from 'lucide-react'
import { DuelType, DuelPuzzleState } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { cn } from '../../../lib/utils'

/**
 * 保存决斗工程模态弹窗
 */
interface SaveProjectModalProps {
  open: boolean
  onClose: () => void
}

/** 决斗分类选项 */
interface DuelTypeOption {
  value: DuelType
  label: string
  desc: string
}

/** 决斗分类选项 */
const DUEL_TYPE_OPTIONS: DuelTypeOption[] = [
  {
    value: 'full',
    label: '整局',
    desc: '完整剧情对局'
  },
  {
    value: 'puzzle',
    label: '残局',
    desc: '战术解谜'
  },
  {
    value: 'combo',
    label: 'Combo',
    desc: '展开'
  }
]

/**
 * 保存决斗工程模态弹窗：
 */
export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ open, onClose }) => {
  const { state, setTitle, setHint, setDuelType } = useDuelStore()

  const [localTitle, setLocalTitle] = useState(() => state.title || '未命名对局')
  const [localHint, setLocalHint] = useState(() => state.hint || '')
  const [localType, setLocalType] = useState<DuelType>(() => state.duelType || 'full')
  const [isSaving, setIsSaving] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  // 弹窗挂载时自动聚焦并全选标题文本
  useEffect(() => {
    const timer = setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus()
        titleInputRef.current.select()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // 处理全局按键 (Esc 取消)
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

    // 1. 同步更新至全局 store
    setTitle(trimmedTitle)
    setHint(trimmedHint)
    setDuelType(localType)

    // 2. 构造即时 state 传给原生保存文件对话框
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
        // 用户在文件选择器中点击了取消，关闭弹窗以保留当前现场
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
        {/* 顶部标题与关闭按钮 */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-foreground">保存决斗工程</h3>
            <p className="text-[11px] text-muted-foreground">
              为本次决斗设置工程分类、名称及战术备忘注释
            </p>
          </div>
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

        {/* 1. 工程分类选择器 */}
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
                    'flex flex-col items-center justify-center py-2 px-1.5 rounded-md transition-all text-center',
                    isSelected
                      ? 'bg-background text-foreground shadow-xs border border-border font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
                  )}
                >
                  <span className="text-xs leading-none">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 tracking-tight scale-90 origin-center whitespace-nowrap">
                    {opt.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. 工程名称输入 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="save-project-title" className="text-xs font-medium text-foreground">
            工程名称
          </label>
          <Input
            id="save-project-title"
            ref={titleInputRef}
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

        {/* 3. 备忘注释与战术要点 (映射为 hint) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="save-project-hint" className="text-xs font-medium text-foreground">
              战术要点 / 剧情注释
            </label>
            <span className="text-[10px] text-muted-foreground">可选</span>
          </div>
          <textarea
            id="save-project-hint"
            value={localHint}
            onChange={(e) => setLocalHint(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault()
                handleConfirmSave()
              }
            }}
            placeholder="记录该局面的战术要点、起手要求、做场终场收益，或同人剧情对白台词等..."
            rows={4}
            disabled={isSaving}
            className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[88px] max-h-[200px] leading-relaxed transition-colors"
          />
          <span className="text-[10px] text-muted-foreground/80">按 Ctrl+Enter 可直接快速保存</span>
        </div>

        {/* 底部操作按钮 */}
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
