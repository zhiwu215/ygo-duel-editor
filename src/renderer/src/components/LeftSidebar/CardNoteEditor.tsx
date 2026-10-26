import React, { useEffect, useRef, useState } from 'react'
import { CardNoteKind } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { cn } from '../../lib/utils'

interface CardNoteEditorProps {
  cardName: string
  kind: CardNoteKind

  initial: { title: string; text: string; source?: string }

  existingTitles?: string[]
  existingTitlesForKind?: (kind: CardNoteKind) => string[]
  kindEditable?: boolean
  onSave: (title: string, text: string, kind: CardNoteKind, source?: string) => Promise<boolean>
  onSuccess?: () => void
  onClose: () => void
}

interface CardNoteOrigin {
  id: 'original' | 'borrowed'
  label: string
}

interface CardNoteDraft {
  title: string
  text: string
}

const NOTE_ORIGINS: CardNoteOrigin[] = [
  { id: 'original', label: '原创' },
  { id: 'borrowed', label: '借鉴' }
]

function emptyDraft(): CardNoteDraft {
  return { title: '', text: '' }
}

function titlePrefixOf(kind: CardNoteKind): string {
  return kind === 'chant' ? '召唤词' : '备注'
}

export const CardNoteEditor: React.FC<CardNoteEditorProps> = ({
  cardName,
  kind,
  initial,
  existingTitles,
  existingTitlesForKind,
  kindEditable,
  onSave,
  onSuccess,
  onClose
}) => {
  const isEdit = Boolean(initial.title)
  const [activeKind, setActiveKind] = useState<CardNoteKind>(kind)
  const kindSelectorVisible = Boolean(kindEditable) && !isEdit
  const effectiveKind = kindSelectorVisible ? activeKind : kind
  const isChant = effectiveKind === 'chant'
  const [drafts, setDrafts] = useState<Record<CardNoteKind, CardNoteDraft>>(() => ({
    chant: kind === 'chant' ? { title: initial.title, text: initial.text } : emptyDraft(),
    note: kind === 'note' ? { title: initial.title, text: initial.text } : emptyDraft()
  }))
  const [origin, setOrigin] = useState<CardNoteOrigin['id']>(
    initial.source && initial.source.length > 0 ? 'borrowed' : 'original'
  )
  const [source, setSource] = useState<string>(initial.source ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const draft = drafts[effectiveKind]

  useEffect(() => {
    if (isEdit) textRef.current?.focus()
    else {
      titleRef.current?.focus()
      titleRef.current?.select()
    }
  }, [isEdit])

  const titlesFor = (target: CardNoteKind): string[] => {
    if (kindSelectorVisible && existingTitlesForKind) return existingTitlesForKind(target)
    return existingTitles ?? []
  }

  const defaultTitleFor = (target: CardNoteKind): string => {
    const prefix = `${titlePrefixOf(target)}-`
    let max = 0
    for (const title of titlesFor(target)) {
      if (!title.startsWith(prefix)) continue
      const seq = Number(title.slice(prefix.length))
      if (Number.isInteger(seq) && seq > max) max = seq
    }
    return `${prefix}${max + 1}`
  }

  const updateDraft = (target: CardNoteKind, patch: Partial<CardNoteDraft>): void => {
    setDrafts((prev) => ({ ...prev, [target]: { ...prev[target], ...patch } }))
  }

  const finish = (): void => {
    if (onSuccess) onSuccess()
    else onClose()
  }

  const handleConfirm = async (): Promise<void> => {
    const targets = kindSelectorVisible
      ? (['chant', 'note'] as CardNoteKind[]).filter((k) => drafts[k].text.trim().length > 0)
      : [effectiveKind]
    if (targets.length === 0) {
      setError(
        kindSelectorVisible
          ? '请填写召唤词或备注内容'
          : isChant
            ? '召唤词内容不能为空'
            : '备注内容不能为空'
      )
      return
    }

    const pending = targets.map((k) => ({
      kind: k,
      title: drafts[k].title.trim() || defaultTitleFor(k),
      text: drafts[k].text.trim()
    }))
    for (const item of pending) {
      if (!item.text) {
        setError(item.kind === 'chant' ? '召唤词内容不能为空' : '备注内容不能为空')
        return
      }
      if (!isEdit && titlesFor(item.kind).includes(item.title)) {
        setError(`已存在「${item.title}」，请换一个标题`)
        return
      }
    }

    setIsSaving(true)
    const saved: CardNoteKind[] = []
    for (const item of pending) {
      const ok = await onSave(
        item.title,
        item.text,
        item.kind,
        item.kind === 'chant' && origin === 'borrowed' ? source.trim() || undefined : undefined
      )
      if (!ok) break
      saved.push(item.kind)
    }
    setIsSaving(false)

    if (saved.length === pending.length) {
      finish()
      return
    }
    if (saved.length === 0) {
      setError('保存失败')
      return
    }
    setDrafts((prev) => {
      const next = { ...prev }
      for (const savedKind of saved) next[savedKind] = emptyDraft()
      return next
    })
    setError('部分内容已保存，请检查剩余内容后重试')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 max-w-md w-full"
      >
        <DialogHeader className="border-b border-border/60 pb-2">
          <DialogTitle className="font-bold text-sm">
            {isEdit
              ? '编辑'
              : kindSelectorVisible
                ? '录入召唤词 / 备注'
                : isChant
                  ? '录入召唤词'
                  : '添加备注'}
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
                  {drafts[opt.k].text.trim().length > 0 && (
                    <span className="ml-1 inline-block h-1 w-1 rounded-full bg-emerald-500 align-middle" />
                  )}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/70">两类都有内容时会一起保存</span>
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
            ref={titleRef}
            type="text"
            value={draft.title}
            placeholder={!isEdit ? `默认：${defaultTitleFor(effectiveKind)}` : undefined}
            onChange={(e) => {
              updateDraft(effectiveKind, { title: e.target.value })
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
            value={draft.text}
            onChange={(e) => {
              updateDraft(effectiveKind, { text: e.target.value })
              setError(null)
            }}
            rows={5}
            style={{ fontSize: 'var(--content-font-size)' }}
            className="w-full resize-none rounded-md border border-border bg-muted/40 px-2.5 py-1.5 leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
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
