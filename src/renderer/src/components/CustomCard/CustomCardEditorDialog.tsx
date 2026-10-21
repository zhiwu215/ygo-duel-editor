import React, { useState } from 'react'
import { CardType } from '@shared/index'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { ImageUp, Save } from 'lucide-react'
import {
  editorFormFromCard,
  useCustomCardStore,
  type CustomCardEditorForm
} from '../../stores/useCustomCardStore'
import { buildInput } from '../../utils/customCardForm'
import {
  resolveKindType,
  resolveToggledType,
  resolveSpellSubType,
  resolveTrapSubType,
  resolveToggledMarkers
} from '../../utils/customCardType'
import { useCustomCardScript } from '../../hooks/useCustomCardScript'
import { TypeFields } from './TypeFields'
import { LinkArrowGrid } from './LinkArrowGrid'
import { ScriptSection } from './ScriptSection'

export const CustomCardEditorDialog: React.FC = () => {
  const editorOpen = useCustomCardStore((s) => s.editorOpen)
  if (!editorOpen) return null
  return <CustomCardEditorBody />
}

const CustomCardEditorBody: React.FC = () => {
  const { cards, editingId, prefillName, closeEditor, save } = useCustomCardStore()
  const editingCard = editingId !== null ? cards.find((c) => c.id === editingId) : undefined
  const [form, setForm] = useState<CustomCardEditorForm>(() =>
    editorFormFromCard(editingCard, prefillName)
  )
  const [imageFailed, setImageFailed] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const {
    staged,
    picking,
    handlePickImage,
    scriptInfo,
    scriptBusy,
    scriptError,
    handlePickScript,
    handleRemoveScript
  } = useCustomCardScript({ editingId, reportError: setError })

  const kind = form.type & (CardType.MONSTER | CardType.SPELL | CardType.TRAP)
  const isMonster = kind === CardType.MONSTER
  const isLink = isMonster && (form.type & CardType.LINK) !== 0
  const isPendulum = isMonster && (form.type & CardType.PENDULUM) !== 0

  const setKind = (kindId: number): void => {
    setForm((f) => ({ ...f, type: resolveKindType(f.type, kindId) }))
  }

  const toggleSub = (mask: number, mutual?: number[]): void => {
    setForm((f) => ({ ...f, type: resolveToggledType(f.type, mask, mutual) }))
  }

  const setSpellSub = (value: string | null): void => {
    if (value === null) return
    setForm((f) => ({ ...f, type: resolveSpellSubType(value) }))
  }

  const setTrapSub = (value: string | null): void => {
    if (value === null) return
    setForm((f) => ({ ...f, type: resolveTrapSubType(value) }))
  }

  const toggleMarker = (mask: number): void => {
    setForm((f) => ({ ...f, markers: resolveToggledMarkers(f.markers, mask) }))
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) {
      setError('卡名不能为空')
      return
    }
    setSaving(true)
    setError('')
    const ok = await save(buildInput(editingId, form, staged))
    setSaving(false)
    if (ok) closeEditor()
    else setError('保存失败，请重试')
  }

  const previewSrc = staged
    ? staged.preview
    : editingId !== null && !imageFailed
      ? getCardImageUrl(editingId)
      : UNKNOWN_CARD_IMAGE

  return (
    <Dialog open onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto gap-3">
        <DialogHeader>
          <DialogTitle>{editingId !== null ? '编辑自定义卡片' : '新建自定义卡片'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[140px_1fr] gap-4">
          <div className="flex flex-col gap-1.5 items-center">
            <div className="aspect-[59/86] w-[140px] rounded-lg overflow-hidden border border-border/80 bg-black/40 shadow-md">
              <img
                src={previewSrc}
                alt={form.name || '自定义卡片'}
                className="size-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget
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
              size="xs"
              className="w-full gap-1.5"
              disabled={picking}
              onClick={() => void handlePickImage()}
            >
              <ImageUp className="w-3.5 h-3.5" />
              <span>{picking ? '选择中…' : '导入卡图'}</span>
            </Button>
            {staged ? (
              <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
                保存后生效
              </p>
            ) : (
              editingId === null && (
                <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
                  未导入时默认使用 unknown 占位图
                </p>
              )
            )}
          </div>

          <div className="flex flex-col gap-2.5 min-w-0">
            <TypeFields
              form={form}
              editingId={editingId}
              kind={kind}
              isMonster={isMonster}
              isSpell={kind === CardType.SPELL}
              isTrap={kind === CardType.TRAP}
              isLink={isLink}
              isPendulum={isPendulum}
              setForm={setForm}
              onSetKind={setKind}
              onToggleSub={toggleSub}
              onSetSpellSub={setSpellSub}
              onSetTrapSub={setTrapSub}
            />
            {isLink && (
              <LinkArrowGrid
                markers={form.markers}
                onToggleMarker={toggleMarker}
                onClear={() => setForm((f) => ({ ...f, markers: 0 }))}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">效果文本</Label>
            <Textarea
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              className="min-h-14 text-xs resize-none"
            />
          </div>

          <ScriptSection
            editingId={editingId}
            scriptInfo={scriptInfo}
            scriptBusy={scriptBusy}
            onPickScript={() => void handlePickScript()}
            onRemoveScript={() => void handleRemoveScript()}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {scriptError && <p className="text-xs text-red-500">{scriptError}</p>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
            取消
          </DialogClose>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || (isLink && form.markers === 0)}
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
