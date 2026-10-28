import React, { useEffect, useMemo, useState } from 'react'
import { ATTRIBUTE_NAMES, RACE_NAMES } from '@shared/index'
import type { CardPoolSchema, CustomCardScriptGenerateResult } from '@shared/index'
import { ImageUp, Loader2, Save } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { useCustomCardStore } from '../../stores/useCustomCardStore'
import { useCopyFeedback } from '../../hooks/useCopyFeedback'
import { useCustomCardImage } from '../../hooks/useCustomCardImage'
import { useCustomCardScript } from '../../hooks/useCustomCardScript'
import { useCustomSetcodeNames } from '../../hooks/useCustomSetcodeNames'
import {
  buildCustomCardDraft,
  buildCustomCardInput,
  formFromCard,
  formWithAiScriptResult,
  validateCustomCardForm,
  type CustomCardEditorForm
} from '../../utils/customCardForm'
import {
  getCardKind,
  getCardTypeSummary,
  getLevelLabel,
  hasLink,
  hasEffect,
  hasPendulum
} from '../../utils/customCardType'
import { CardIdentityFields } from './CardIdentityFields'
import { CardKindFields } from './CardKindFields'
import { MonsterStatsFields } from './MonsterStatsFields'
import { CardScriptField } from './CardScriptField'
import { AiScriptPanel } from './AiScriptPanel'
import { CardAdvancedFields } from './CardAdvancedFields'
import { alertDialog } from '../../stores/useDialogStore'

export const CustomCardEditorDialog: React.FC = () => {
  const editorOpen = useCustomCardStore((state) => state.editorOpen)
  const editingId = useCustomCardStore((state) => state.editingId)
  if (!editorOpen) return null
  return <CustomCardEditorBody key={editingId ?? 'new'} />
}

const EditorSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children
}) => (
  <section className="rounded-xl border border-border/60 bg-card/30 p-4">
    <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
    <div className="mt-3">{children}</div>
  </section>
)

const CustomCardEditorBody: React.FC = () => {
  const { cards, editingId, prefillName, closeEditor, save } = useCustomCardStore()
  const editingCard = editingId !== null ? cards.find((card) => card.id === editingId) : undefined
  const [form, setForm] = useState<CustomCardEditorForm>(() =>
    formFromCard(editingCard, prefillName)
  )
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [aiScriptApplyTick, setAiScriptApplyTick] = useState(0)
  const [imageFailed, setImageFailed] = useState<boolean>(false)
  const [setnames, setSetnames] = useState<Array<{ code: number; name: string }>>([])
  const [poolSchema, setPoolSchema] = useState<CardPoolSchema>('classic')
  const { copiedField, copy } = useCopyFeedback('CustomCardEditorDialog')
  const { stagedImage, pickingImage, pickImage } = useCustomCardImage(setError)
  const cardId = editingId ?? createdId
  const script = useCustomCardScript({ editingId: cardId })
  const { reloadScript } = script
  const customSetcodes = useCustomSetcodeNames()
  const aiScriptApplied = aiScriptApplyTick > 0

  useEffect(() => {
    let cancelled = false
    void window.api
      .getCardSearchFilterOptions()
      .then((options) => {
        if (cancelled) return
        setSetnames(options.setnames ?? [])
        setPoolSchema(options.poolSchema)
      })
      .catch((err) => {
        console.error('[CustomCardEditorDialog] load filter options failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (aiScriptApplied) void reloadScript()
  }, [aiScriptApplied, reloadScript])

  const isMonster = getCardKind(form.type) === 'monster'
  const isLink = hasLink(form.type)
  const isPendulum = hasPendulum(form.type)
  const isFlavorText = isMonster && !hasEffect(form.type)
  const hasScript =
    aiScriptApplied ||
    (cardId !== null ? Boolean(script.scriptInfo?.exists) : script.stagedScript !== null)
  const validation = useMemo(
    () => validateCustomCardForm(cardId, form, hasScript),
    [cardId, form, hasScript]
  )

  const previewSrc = stagedImage?.preview
    ? stagedImage.preview
    : editingId !== null && !imageFailed
      ? getCardImageUrl(editingId)
      : UNKNOWN_CARD_IMAGE

  const scriptIdMismatch =
    cardId === null &&
    script.stagedScript?.suggestedId !== undefined &&
    form.id.trim() !== '' &&
    Number(form.id) !== script.stagedScript.suggestedId

  const scriptNotice =
    (aiScriptApplied
      ? createdId !== null
        ? 'AI 脚本已应用，卡片已自动保存。'
        : 'AI 脚本已应用，保存卡片后生效。'
      : '') ||
    script.scriptNotice ||
    (scriptIdMismatch
      ? `脚本文件名建议卡密 ${script.stagedScript?.suggestedId}，当前卡密为 ${form.id}；保存后会关联为 c${form.id}.lua`
      : '')

  const handlePickScript = async (): Promise<void> => {
    const picked = await script.pickScript()
    if (!picked) return
    setAiScriptApplyTick(0)
    if (picked.suggestedId !== undefined && cardId === null && !form.id.trim()) {
      setForm((current) => ({ ...current, id: String(picked.suggestedId) }))
    }
  }

  const handleRemoveScript = async (): Promise<void> => {
    await script.removeScript()
    setAiScriptApplyTick(0)
  }

  const handleAiApplied = (result: CustomCardScriptGenerateResult): void => {
    setAiScriptApplyTick((tick) => tick + 1)
    setForm((current) => formWithAiScriptResult(current, result))
    script.dropStaged()
  }

  const handleEnsureCardSaved = async (result: CustomCardScriptGenerateResult): Promise<number> => {
    if (cardId !== null) return cardId
    const nextForm = formWithAiScriptResult(form, result)
    const nextValidation = validateCustomCardForm(null, nextForm, true)
    if (nextValidation.errors.length > 0) throw new Error(nextValidation.errors[0])
    setSaving(true)
    setError('')
    try {
      const saved = await save(buildCustomCardInput(null, nextForm, stagedImage?.path))
      if (!saved.success || !saved.card) throw new Error(saved.error ?? '保存失败')
      setForm((current) => formWithAiScriptResult(current, result))
      setCreatedId(saved.card.id)
      return saved.card.id
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (validation.errors.length > 0) {
      setError(validation.errors[0])
      return
    }
    setSaving(true)
    setError('')
    const result = await save(
      buildCustomCardInput(cardId, form, stagedImage?.path, script.stagedScript?.filePath)
    )
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? '保存失败')
      return
    }
    if (result.warning) {
      await alertDialog(`卡片已保存。\n${result.warning}`)
    }
    closeEditor()
  }

  const meta = isMonster
    ? [
        ATTRIBUTE_NAMES[form.attribute] ?? '无属性',
        RACE_NAMES[form.race] ?? '未知种族',
        `${getLevelLabel(form.type)} ${form.level || '0'}`
      ].join(' · ')
    : ''

  return (
    <Dialog open onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
      <DialogContent className="!flex !h-[88vh] !w-[calc(100vw-48px)] !max-w-[1080px] !flex-col !gap-0 !overflow-hidden !p-0 sm:!max-w-[1080px]">
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex h-14 shrink-0 items-center border-b border-border/70 px-6 pr-12">
            <DialogTitle className="text-base font-semibold">
              {cardId !== null ? '编辑自定义卡片' : '新建自定义卡片'}
            </DialogTitle>
          </header>

          <div className="flex min-h-0 flex-1">
            <aside className="w-[240px] shrink-0 overflow-y-auto border-r border-border/70 bg-muted/15 p-5">
              <div className="aspect-[59/86] w-full overflow-hidden rounded-lg border border-border/80 bg-black/40 shadow-md">
                <img
                  src={previewSrc}
                  alt={form.name || '自定义卡片'}
                  className="size-full object-cover"
                  onError={(event) => {
                    const target = event.currentTarget
                    if (target.src !== UNKNOWN_CARD_IMAGE) {
                      target.src = UNKNOWN_CARD_IMAGE
                      setImageFailed(true)
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full gap-1.5"
                disabled={pickingImage}
                onClick={() => void pickImage()}
              >
                <ImageUp className="h-3.5 w-3.5" />
                <span>{pickingImage ? '选择中…' : '导入卡图'}</span>
              </Button>
              <p className="mt-1.5 text-center text-[10px] leading-relaxed text-muted-foreground">
                {stagedImage ? '保存后生效' : '未导入时使用 unknown 占位图'}
              </p>

              <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-xs font-medium">{getCardTypeSummary(form.type)}</p>
                {meta && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{meta}</p>
                )}
                {isLink && (
                  <p className="mt-1 text-[11px] text-muted-foreground">连接 · 无守备力</p>
                )}
                {isPendulum && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    刻度 {form.scaleLeft || '0'} / {form.scaleRight || '0'}
                  </p>
                )}
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="flex flex-col gap-4">
                  <EditorSection title="基本信息">
                    <CardIdentityFields
                      form={form}
                      setForm={setForm}
                      editingId={cardId}
                      copiedField={copiedField}
                      onCopy={(field, text) => void copy(field, text)}
                      suggestedId={script.stagedScript?.suggestedId}
                    />
                  </EditorSection>

                  <EditorSection title="卡片种类">
                    <CardKindFields form={form} setForm={setForm} />
                  </EditorSection>

                  {isMonster && (
                    <EditorSection title="属性与数值">
                      <MonsterStatsFields form={form} setForm={setForm} poolSchema={poolSchema} />
                    </EditorSection>
                  )}

                  <EditorSection title={isFlavorText ? '描述文本' : '效果文本'}>
                    <Textarea
                      value={form.desc}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, desc: event.target.value }))
                      }
                      placeholder={isFlavorText ? '卡面描述' : '填写效果文本；效果由外部脚本实现'}
                      className="min-h-[160px] resize-y text-xs leading-relaxed"
                    />
                  </EditorSection>

                  {!isFlavorText && (
                    <AiScriptPanel
                      card={buildCustomCardDraft(cardId, form)}
                      onEnsureId={(id) => setForm((current) => ({ ...current, id: String(id) }))}
                      onEnsureSaved={handleEnsureCardSaved}
                      onApplied={handleAiApplied}
                    />
                  )}

                  <CardScriptField
                    editingId={cardId}
                    scriptInfo={script.scriptInfo}
                    stagedScript={script.stagedScript}
                    busy={script.scriptBusy}
                    error={script.scriptError}
                    notice={scriptNotice}
                    onPick={() => void handlePickScript()}
                    onRemove={() => void handleRemoveScript()}
                  />

                  <CardAdvancedFields
                    form={form}
                    setForm={setForm}
                    setnames={setnames}
                    customSetcodeNames={customSetcodes.names}
                    usedStringIds={script.usedStringIds}
                    onRenameSetcode={(codeHex) => void customSetcodes.rename(codeHex)}
                  />
                </div>
              </div>

              <footer className="shrink-0 border-t border-border/70 bg-muted/20 px-6 py-3">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    {error ? (
                      <p className="text-[11px] text-red-500">{error}</p>
                    ) : validation.warnings.length > 0 ? (
                      <ul className="space-y-0.5 text-[11px] text-amber-500">
                        {validation.warnings.slice(0, 2).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {createdId !== null
                          ? '卡片已自动保存，可继续编辑。'
                          : '保存后可在卡片列表中同步到游戏。'}
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={closeEditor}>
                    {createdId !== null ? '关闭' : '取消'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={saving || script.scriptBusy}
                    onClick={() => void handleSave()}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>{saving ? '保存中…' : '保存'}</span>
                  </Button>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
