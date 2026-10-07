import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CardNoteKind } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { cn } from '../../lib/utils'

interface CardNoteEditorProps {
  cardName: string
  kind: CardNoteKind

  initial: { label: string; text: string; source?: string }

  existingLabels?: string[]
  existingLabelsForKind?: (kind: CardNoteKind) => string[]
  kindEditable?: boolean
  onSave: (label: string, text: string, kind: CardNoteKind, source?: string) => Promise<boolean>
  onClose: () => void
}

interface CardNoteOrigin {
  id: 'original' | 'borrowed'
  label: string
}

const NOTE_ORIGINS: CardNoteOrigin[] = [
  { id: 'original', label: '原创' },
  { id: 'borrowed', label: '借鉴' }
]

export const CardNoteEditor: React.FC<CardNoteEditorProps> = ({
  cardName,
  kind,
  initial,
  existingLabels,
  existingLabelsForKind,
  kindEditable,
  onSave,
  onClose
}) => {
  const isEdit = Boolean(initial.label)
  const [activeKind, setActiveKind] = useState<CardNoteKind>(kind)
  const kindSelectorVisible = Boolean(kindEditable) && !isEdit
  const effectiveKind = kindSelectorVisible ? activeKind : kind
  const isChant = effectiveKind === 'chant'
  const existingLabelList =
    kindSelectorVisible && existingLabelsForKind
      ? existingLabelsForKind(effectiveKind)
      : (existingLabels ?? [])
  const labelPrefix = isChant ? '召唤词' : '备注'
  const nextSeq = useMemo(() => {
    const prefix = `${labelPrefix}-`
    let max = 0
    for (const l of existingLabelList) {
      if (!l.startsWith(prefix)) continue
      const n = Number(l.slice(prefix.length))
      if (Number.isInteger(n) && n > max) max = n
    }
    return max + 1
  }, [existingLabelList, labelPrefix])
  const defaultLabel = `${labelPrefix}-${nextSeq}`
  const [label, setLabel] = useState<string>(initial.label)
  const [text, setText] = useState<string>(initial.text)
  const [origin, setOrigin] = useState<CardNoteOrigin['id']>(
    initial.source && initial.source.length > 0 ? 'borrowed' : 'original'
  )
  const [source, setSource] = useState<string>(initial.source ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEdit) textRef.current?.focus()
    else {
      labelRef.current?.focus()
      labelRef.current?.select()
    }
  }, [isEdit])

  const handleConfirm = async (): Promise<void> => {
    const trimmedText = text.trim()
    const trimmedLabel = label.trim() || (!isEdit ? defaultLabel : '')
    if (!trimmedLabel) {
      setError('请填写标题')
      return
    }
    if (!trimmedText) {
      setError(isChant ? '召唤词内容不能为空' : '备注内容不能为空')
      return
    }

    if (!isEdit && existingLabelList.includes(trimmedLabel)) {
      setError(`已存在「${trimmedLabel}」，保存会覆盖它`)
      return
    }
    setIsSaving(true)
    const borrowedSource = isChant && origin === 'borrowed' ? source.trim() : ''
    const ok = await onSave(trimmedLabel, trimmedText, effectiveKind, borrowedSource || undefined)
    setIsSaving(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 max-w-md w-full"
      >
        <DialogHeader className="border-b border-border/60 pb-2">
          <DialogTitle className="font-bold text-sm">
            {isEdit ? '编辑' : isChant ? '录入召唤词' : '添加备注'}
          </DialogTitle>
          <div className="text-[10px] text-muted-foreground truncate">{cardName}</div>
        </DialogHeader>

        {kindSelectorVisible && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">类型</span>
            <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-muted/50">
              {[
                { k: 'chant' as CardNoteKind, label: '召唤词' },
                { k: 'note' as CardNoteKind, label: '备注' }
              ].map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => {
                    setActiveKind(opt.k)
                    setError(null)
                  }}
                  className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    effectiveKind === opt.k
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isChant && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">来源</span>
            <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-muted/50">
              {NOTE_ORIGINS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setOrigin(opt.id)
                    setError(null)
                  }}
                  className={cn(
                    'flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer',
                    origin === opt.id
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {origin === 'borrowed' && (
              <Input
                type="text"
                value={source}
                placeholder="注明来源"
                onChange={(e) => {
                  setSource(e.target.value)
                  setError(null)
                }}
                className="h-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {isEdit ? '标题' : '标题（可选）'}
          </span>
          <Input
            ref={labelRef}
            type="text"
            value={label}
            placeholder={!isEdit ? `默认：${defaultLabel}` : undefined}
            onChange={(e) => {
              setLabel(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleConfirm()
              }
            }}
            className="h-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {isChant ? '召唤词' : '备注'}
          </span>
          <Textarea
            ref={textRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            rows={5}
            className="w-full resize-none rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {error && <span className="text-[11px] text-destructive">{error}</span>}

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
            disabled={isSaving}
            className="h-7 text-xs font-bold shadow-xs"
          >
            {isEdit ? '保存' : '添加'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
