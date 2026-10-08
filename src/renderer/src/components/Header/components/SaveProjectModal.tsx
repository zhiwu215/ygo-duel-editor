import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import React, { useState } from 'react'
import { X, Save, Plus } from 'lucide-react'
import { DuelType, DuelPuzzleState } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useConfigStore } from '../../../stores/useConfigStore'
import { alertDialog } from '../../../stores/useDialogStore'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SeriesNameDialog } from '../../LeftSidebar/SeriesNameDialog'
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

/** 下拉项不允许空值，未归类用哨兵值代替 */
const UNFILED_VALUE = '__unfiled__'

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ open, onClose }) => {
  const { state, setTitle, setHint, setDuelType, setSeries, setCurrentProjectPath } = useDuelStore()
  const { config, loadConfig } = useConfigStore()

  const [localTitle, setLocalTitle] = useState(() => state.title || '未命名对局')
  const [localHint, setLocalHint] = useState(() => state.hint || '')
  const [localType, setLocalType] = useState<DuelType>(() => state.duelType || 'full')
  const [localSeries, setLocalSeries] = useState(() => state.series || '')
  const [isSaving, setIsSaving] = useState(false)
  const [showNewSeries, setShowNewSeries] = useState(false)

  const seriesNames = (config.projectSeries || []).filter((n) => n && n.trim())

  const handleConfirmSave = async (): Promise<void> => {
    if (isSaving) return

    const trimmedTitle = localTitle.trim() || '未命名对局'
    const trimmedHint = localHint.trim()

    setTitle(trimmedTitle)
    setHint(trimmedHint)
    setDuelType(localType)
    setSeries(localSeries)

    const stateToSave: DuelPuzzleState = {
      ...state,
      title: trimmedTitle,
      hint: trimmedHint,
      duelType: localType,
      series: localSeries
    }

    setIsSaving(true)
    try {
      const res = await window.api.saveProjectFile(stateToSave)
      if (res.success && res.filePath) {
        setCurrentProjectPath(res.filePath)
        onClose()
        void alertDialog(`工程已成功保存：\n${res.filePath}`)
      } else {
        onClose()
      }
    } catch (err) {
      console.error('[SaveProjectModal] 保存工程失败:', err)
      void alertDialog('保存工程失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md gap-4 p-5">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-semibold text-foreground">保存决斗工程</DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

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
          <label className="text-xs font-medium text-foreground">所属作品</label>
          <div className="flex items-center gap-1.5">
            <Select
              value={localSeries || UNFILED_VALUE}
              onValueChange={(val: string | null) => {
                if (!val) return
                setLocalSeries(val === UNFILED_VALUE ? '' : val)
              }}
            >
              <SelectTrigger size="sm" className="flex-1 h-8 text-xs bg-background/60">
                <SelectValue>{localSeries || '未归类'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNFILED_VALUE}>未归类</SelectItem>
                {seriesNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setShowNewSeries(true)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                }
              />
              <TooltipContent>新建分类</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            按来源归类，例如把同一本小说里的对局都放进同一个作品分类
          </p>
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
          <Textarea
            id="save-project-hint"
            value={localHint}
            onChange={(e) => setLocalHint(e.target.value)}
            rows={4}
            disabled={isSaving}
            className="resize-y min-h-[88px] max-h-[200px] leading-relaxed"
          />
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-border/60 pt-2">
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
        </DialogFooter>
      </DialogContent>

      {showNewSeries && (
        <SeriesNameDialog
          title="新建分类"
          confirmLabel="创建"
          onConfirm={async (name) => {
            const res = await window.api.createProjectSeries(name)
            if (!res.success) return res.error || '新建分类失败'
            await loadConfig()
            setLocalSeries(name.trim())
            return null
          }}
          onClose={() => setShowNewSeries(false)}
        />
      )}
    </Dialog>
  )
}
