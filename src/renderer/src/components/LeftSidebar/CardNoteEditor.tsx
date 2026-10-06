import React, { useEffect, useRef, useState } from 'react'
import { BookMarked, X } from 'lucide-react'
import { CardNoteKind } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface CardNoteEditorProps {
  cardName: string
  kind: CardNoteKind

  initial: { label: string; text: string }

  existingLabels: string[]
  onSave: (label: string, text: string) => Promise<boolean>
  onClose: () => void
}

export const CardNoteEditor: React.FC<CardNoteEditorProps> = ({
  cardName,
  kind,
  initial,
  existingLabels,
  onSave,
  onClose
}) => {
  const isEdit = Boolean(initial.label)
  const isChant = kind === 'chant'
  const [label, setLabel] = useState<string>(initial.label)
  const [text, setText] = useState<string>(initial.text)
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
    const trimmedLabel = label.trim()
    const trimmedText = text.trim()
    if (!trimmedLabel) {
      setError('请填写标题')
      return
    }
    if (!trimmedText) {
      setError(isChant ? '召唤词内容不能为空' : '描述内容不能为空')
      return
    }

    if (!isEdit && existingLabels.includes(trimmedLabel)) {
      setError(`已存在「${trimmedLabel}」，保存会覆盖它`)
      return
    }
    setIsSaving(true)
    const ok = await onSave(trimmedLabel, trimmedText)
    setIsSaving(false)
    if (ok) onClose()
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 max-w-md w-full animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookMarked className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm">
                {isEdit ? '编辑' : isChant ? '录入召唤词' : '添加描述'}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{cardName}</div>
            </div>
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
          <span className="text-xs font-semibold text-muted-foreground">标题</span>
          <Input
            ref={labelRef}
            type="text"
            value={label}
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
            {isChant ? '召唤词' : '描述'}
          </span>
          <textarea
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
      </div>
    </div>
  )
}
