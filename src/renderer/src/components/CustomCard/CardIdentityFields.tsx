import React from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import type { CustomCardEditorForm } from '../../utils/customCardForm'

interface CardIdentityFieldsProps {
  form: CustomCardEditorForm
  setForm: React.Dispatch<React.SetStateAction<CustomCardEditorForm>>
  editingId: number | null
  copiedField: string | null
  onCopy: (field: string, text: string) => void
  suggestedId?: number
}

export const CardIdentityFields: React.FC<CardIdentityFieldsProps> = ({
  form,
  setForm,
  editingId,
  copiedField,
  onCopy,
  suggestedId
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="custom-card-name" className="text-xs text-muted-foreground">
          卡名
        </Label>
        <Input
          id="custom-card-name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          className="h-9 text-sm"
          placeholder="输入卡名"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          {editingId !== null ? (
            <span className="text-xs text-muted-foreground">卡密</span>
          ) : (
            <Label htmlFor="custom-card-id" className="text-xs text-muted-foreground">
              卡密
            </Label>
          )}
          {editingId !== null && (
            <span className="font-mono text-[11px] text-muted-foreground">
              脚本文件名 c{editingId}.lua
            </span>
          )}
        </div>

        {editingId !== null ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 flex-1 items-center rounded-lg border border-input bg-transparent px-2.5 font-mono text-xs">
              {editingId}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onCopy('id', String(editingId))}
            >
              {copiedField === 'id' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedField === 'id' ? '已复制' : '复制'}</span>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                id="custom-card-id"
                value={form.id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    id: event.target.value.replace(/[^\d]/g, '').slice(0, 10)
                  }))
                }
                placeholder="留空自动生成"
                inputMode="numeric"
                className="h-8 font-mono text-xs"
              />
              {suggestedId !== undefined && form.id === String(suggestedId) && (
                <span className="shrink-0 rounded bg-primary/15 px-1.5 py-1 text-[10px] font-medium text-primary">
                  来自脚本文件名
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              留空时从 900000000 起按顺序取未占用的卡密，也可以手填；保存时会检查官方卡库冲突。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
