import { useMemo, useState, type JSX } from 'react'
import { AgentModelInfo } from '@shared/index'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/dialog'
import { cn } from '../../../lib/utils'
import { MODEL_HINT, MODEL_INPUT } from './modelSettingsStyles'

interface FetchModelsDialogProps {
  models: AgentModelInfo[]
  initialSelected: string[]
  onAdopt: (models: AgentModelInfo[]) => void
  onClose: () => void
}

export function FetchModelsDialog({
  models,
  initialSelected,
  onAdopt,
  onClose
}: FetchModelsDialogProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(initialSelected))
  const normalized = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      normalized.length === 0
        ? models
        : models.filter(
            (model) =>
              model.id.toLowerCase().includes(normalized) ||
              model.name?.toLowerCase().includes(normalized) === true
          ),
    [models, normalized]
  )
  const allVisiblePicked = visible.length > 0 && visible.every((model) => picked.has(model.id))

  const toggle = (id: string): void => {
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const toggleVisible = (): void => {
    setPicked((current) => {
      const next = new Set(current)
      if (allVisiblePicked) {
        for (const model of visible) next.delete(model.id)
      } else {
        for (const model of visible) next.add(model.id)
      }
      return next
    })
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[520px] gap-3 p-4">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm font-medium">选择要添加的模型</DialogTitle>
          <DialogDescription className="text-xs leading-[18px]">
            以下是模型提供商的可用模型，勾选要添加的模型。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="search"
            value={query}
            placeholder="搜索模型"
            aria-label="搜索模型"
            onChange={(event) => setQuery(event.target.value)}
            className={cn(MODEL_INPUT, 'h-8 flex-1')}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={visible.length === 0}
            onClick={toggleVisible}
            className="h-7 shrink-0 px-2 text-xs"
          >
            {allVisiblePicked ? '取消全选' : '全选'}
          </Button>
        </div>

        {visible.length === 0 ? (
          <p className={cn(MODEL_HINT, 'py-6 text-center')} role="status">
            没有匹配的模型。
          </p>
        ) : (
          <ul className="max-h-[320px] overflow-y-auto rounded-[12px] border-[0.5px] border-foreground/15">
            {visible.map((model) => (
              <li key={model.id} className="border-b-[0.5px] border-foreground/10 last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs leading-[18px] hover:bg-foreground/5">
                  <Checkbox
                    checked={picked.has(model.id)}
                    aria-label={model.name ?? model.id}
                    onCheckedChange={() => toggle(model.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{model.name ?? model.id}</span>
                  {model.name && model.name !== model.id ? (
                    <span className={cn(MODEL_HINT, 'shrink-0 font-mono text-[11px]')}>
                      {model.id}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="-mx-4 -mb-4 flex-row justify-end gap-2 rounded-b-xl border-t bg-transparent p-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            取消
          </Button>
          <Button
            size="sm"
            disabled={picked.size === 0}
            onClick={() => onAdopt(models.filter((model) => picked.has(model.id)))}
            className="h-8 text-xs"
          >
            添加所选
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
