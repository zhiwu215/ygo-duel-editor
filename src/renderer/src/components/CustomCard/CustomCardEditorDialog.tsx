import React, { useEffect, useState } from 'react'
import {
  ATTRIBUTE_NAMES,
  CardType,
  LINK_MARKERS,
  RACE_NAMES,
  CustomCardInput,
  CustomCardScriptInfo
} from '@shared/index'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '../../lib/utils'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import {
  editorFormFromCard,
  useCustomCardStore,
  type CustomCardEditorForm
} from '../../stores/useCustomCardStore'
import { FileCode2, FolderOpen, ImageUp, Save, Trash2 } from 'lucide-react'

const KINDS: Array<{ id: number; label: string }> = [
  { id: CardType.MONSTER, label: '怪兽' },
  { id: CardType.SPELL, label: '魔法' },
  { id: CardType.TRAP, label: '陷阱' }
]

const MONSTER_SUBTYPES: Array<{ mask: number; label: string; mutual?: number[] }> = [
  { mask: CardType.NORMAL, label: '通常', mutual: [CardType.EFFECT] },
  { mask: CardType.EFFECT, label: '效果', mutual: [CardType.NORMAL] },
  { mask: CardType.FUSION, label: '融合' },
  { mask: CardType.SYNCHRO, label: '同调' },
  { mask: CardType.XYZ, label: '超量' },
  { mask: CardType.LINK, label: '连接' },
  { mask: CardType.RITUAL, label: '仪式' },
  { mask: CardType.PENDULUM, label: '灵摆' },
  { mask: CardType.TUNER, label: '调整' },
  { mask: CardType.FLIP, label: '反转' }
]

const SPELL_SUBTYPES: Array<{ mask: number; label: string }> = [
  { mask: CardType.QUICKPLAY, label: '速攻' },
  { mask: CardType.CONTINUOUS, label: '永续' },
  { mask: CardType.EQUIP, label: '装备' },
  { mask: CardType.FIELD, label: '场地' },
  { mask: CardType.RITUAL, label: '仪式' }
]

const TRAP_SUBTYPES: Array<{ mask: number; label: string }> = [
  { mask: CardType.CONTINUOUS, label: '永续' },
  { mask: CardType.COUNTER, label: '反击' }
]

const LINK_ARROW_GRID: Array<Array<{ mask: number; label: string } | null>> = [
  [LINK_MARKERS[0], LINK_MARKERS[1], LINK_MARKERS[2]],
  [LINK_MARKERS[3], null, LINK_MARKERS[4]],
  [LINK_MARKERS[5], LINK_MARKERS[6], LINK_MARKERS[7]]
]

const STAT_UNKNOWN = -2

function parseStat(value: string): number {
  const text = value.trim()
  if (!text) return STAT_UNKNOWN
  const num = Number(text)
  if (!Number.isFinite(num)) return STAT_UNKNOWN
  return Math.trunc(num)
}

function parseCount(value: string, fallback = 0): number {
  const num = Number(value.trim())
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.min(255, Math.trunc(num))
}

function formatScriptSize(size: number | undefined): string {
  if (!size || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

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
  const [staged, setStaged] = useState<{ path: string; preview: string } | null>(null)
  const [imageFailed, setImageFailed] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [picking, setPicking] = useState<boolean>(false)
  const [scriptInfo, setScriptInfo] = useState<CustomCardScriptInfo | null>(null)
  const [scriptBusy, setScriptBusy] = useState<boolean>(false)
  const [scriptError, setScriptError] = useState<string>('')

  useEffect(() => {
    if (editingId === null) return
    let cancelled = false
    void window.api
      .getCustomCardScript(editingId)
      .then((info) => {
        if (!cancelled) setScriptInfo(info)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [editingId])

  const kind = form.type & (CardType.MONSTER | CardType.SPELL | CardType.TRAP)
  const isMonster = kind === CardType.MONSTER
  const isSpell = kind === CardType.SPELL
  const isTrap = kind === CardType.TRAP
  const isLink = isMonster && (form.type & CardType.LINK) !== 0
  const isPendulum = isMonster && (form.type & CardType.PENDULUM) !== 0

  const setKind = (kindId: number): void => {
    setForm((f) => {
      let type = kindId
      if (kindId !== CardType.MONSTER) {
        if (kindId === CardType.SPELL) type = CardType.SPELL
        else type = CardType.TRAP
      } else if ((f.type & CardType.MONSTER) !== 0) {
        let kept = CardType.MONSTER
        for (const sub of MONSTER_SUBTYPES) {
          if ((f.type & sub.mask) !== 0) kept |= sub.mask
        }
        type = kept
      } else {
        type = CardType.MONSTER | CardType.EFFECT
      }
      return { ...f, type }
    })
  }

  const toggleSub = (mask: number, mutual?: number[]): void => {
    setForm((f) => {
      let type = f.type
      if ((type & mask) !== 0) {
        type &= ~mask
      } else {
        for (const m of mutual ?? []) type &= ~m
        type |= mask
      }
      return { ...f, type }
    })
  }

  const setSpellSub = (value: string | null): void => {
    if (value === null) return
    setForm((f) => ({
      ...f,
      type: value === 'none' ? CardType.SPELL : CardType.SPELL | Number(value)
    }))
  }

  const setTrapSub = (value: string | null): void => {
    if (value === null) return
    setForm((f) => ({
      ...f,
      type: value === 'none' ? CardType.TRAP : CardType.TRAP | Number(value)
    }))
  }

  const toggleMarker = (mask: number): void => {
    setForm((f) => ({
      ...f,
      markers: (f.markers & mask) !== 0 ? f.markers & ~mask : f.markers | mask
    }))
  }

  const spellSubValue = SPELL_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.mask ?? 'none'
  const trapSubValue = TRAP_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.mask ?? 'none'
  const spellSubLabel = SPELL_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.label ?? '通常'
  const trapSubLabel = TRAP_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.label ?? '通常'

  const buildInput = (): CustomCardInput => {
    const base = {
      id: editingId ?? undefined,
      name: form.name,
      desc: form.desc,
      imageSourcePath: staged?.path
    }
    if (isMonster) {
      const level = parseCount(form.level)
      const lscale = isPendulum ? parseCount(form.scaleLeft ?? '') : 0
      const rscale = isPendulum ? parseCount(form.scaleRight ?? '') : 0
      return {
        ...base,
        type: form.type,
        attribute: isMonster ? form.attribute : 0,
        race: isMonster ? form.race : 0,
        level: lscale * 0x1000000 + rscale * 0x10000 + level,
        atk: parseStat(form.atk),
        def: isLink ? form.markers : parseStat(form.def)
      }
    }
    return {
      ...base,
      type: isSpell ? form.type : form.type,
      attribute: 0,
      race: 0,
      level: 0,
      atk: 0,
      def: 0
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) {
      setError('卡名不能为空')
      return
    }
    setSaving(true)
    setError('')
    const ok = await save(buildInput())
    setSaving(false)
    if (ok) closeEditor()
    else setError('保存失败，请重试')
  }

  const handlePickImage = async (): Promise<void> => {
    setPicking(true)
    try {
      const res = await window.api.pickCustomCardImage()
      if (!res.success && res.error) {
        setError(res.error)
      } else if (res.success && res.filePath) {
        setStaged({ path: res.filePath, preview: res.previewDataUrl ?? '' })
        setError('')
      }
    } finally {
      setPicking(false)
    }
  }

  const previewSrc = staged
    ? staged.preview
    : editingId !== null && !imageFailed
      ? getCardImageUrl(editingId)
      : UNKNOWN_CARD_IMAGE

  const handlePickScript = async (): Promise<void> => {
    if (editingId === null) return
    setScriptBusy(true)
    try {
      const res = await window.api.pickCustomCardScript(editingId)
      if (res.canceled) return
      if (!res.success) {
        setScriptError(res.error ?? '脚本导入失败')
        return
      }
      setScriptInfo(res.info ?? null)
      setScriptError('')
    } finally {
      setScriptBusy(false)
    }
  }

  const handleRemoveScript = async (): Promise<void> => {
    if (editingId === null) return
    setScriptBusy(true)
    try {
      const res = await window.api.deleteCustomCardScript(editingId)
      if (!res.success) {
        setScriptError(res.error ?? '脚本删除失败')
        return
      }
      setScriptInfo(res.info ?? null)
      setScriptError('')
    } finally {
      setScriptBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId !== null ? '编辑自建卡' : '新建自建卡'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[170px_1fr] gap-4">
          <div className="flex flex-col gap-1.5 items-center">
            <div className="aspect-[59/86] w-[170px] rounded-lg overflow-hidden border border-border/80 bg-black/40 shadow-md">
              <img
                src={previewSrc}
                alt={form.name || '自建卡'}
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
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">卡名</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>卡密</span>
              <span className="font-mono text-foreground/80">
                {editingId ?? '保存后自动生成'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">卡片种类</Label>
              <div className="flex gap-1.5">
                {KINDS.map((k) => (
                  <Button
                    key={k.id}
                    type="button"
                    variant={kind === k.id ? 'default' : 'secondary'}
                    size="sm"
                    className="h-7 px-3 text-[11px]"
                    onClick={() => setKind(k.id)}
                  >
                    {k.label}
                  </Button>
                ))}
              </div>
            </div>

            {isMonster && (
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">细分</Label>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {MONSTER_SUBTYPES.map((sub) => (
                    <label
                      key={sub.mask}
                      className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={(form.type & sub.mask) !== 0}
                        onCheckedChange={() => toggleSub(sub.mask, sub.mutual)}
                      />
                      <span>{sub.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isSpell && (
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground shrink-0">魔法细分</Label>
                <Select value={String(spellSubValue)} onValueChange={(val) => setSpellSub(val)}>
                  <SelectTrigger size="sm" className="h-7 text-xs w-32">
                    <SelectValue>{spellSubLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">通常</SelectItem>
                    {SPELL_SUBTYPES.map((sub) => (
                      <SelectItem key={sub.mask} value={String(sub.mask)}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isTrap && (
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground shrink-0">陷阱细分</Label>
                <Select value={String(trapSubValue)} onValueChange={(val) => setTrapSub(val)}>
                  <SelectTrigger size="sm" className="h-7 text-xs w-32">
                    <SelectValue>{trapSubLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">通常</SelectItem>
                    {TRAP_SUBTYPES.map((sub) => (
                      <SelectItem key={sub.mask} value={String(sub.mask)}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isMonster && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">属性</Label>
                  <Select
                    value={String(form.attribute)}
                    onValueChange={(val) => setForm((f) => ({ ...f, attribute: Number(val) }))}
                  >
                    <SelectTrigger size="sm" className="h-7 text-xs w-full">
                      <SelectValue>{ATTRIBUTE_NAMES[form.attribute] ?? '无'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ATTRIBUTE_NAMES).map(([mask, label]) => (
                        <SelectItem key={mask} value={mask}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">种族</Label>
                  <Select
                    value={String(form.race)}
                    onValueChange={(val) => setForm((f) => ({ ...f, race: Number(val) }))}
                  >
                    <SelectTrigger size="sm" className="h-7 text-xs w-full">
                      <SelectValue>{RACE_NAMES[form.race] ?? '未知'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RACE_NAMES).map(([mask, label]) => (
                        <SelectItem key={mask} value={mask}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isLink && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {isPendulum ? '怪兽等级' : '等级 / 阶级'}
                    </Label>
                    <Input
                      inputMode="numeric"
                      value={form.level}
                      onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                )}

                {isPendulum && (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px] text-muted-foreground">左刻度</Label>
                      <Input
                        inputMode="numeric"
                        value={form.scaleLeft ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, scaleLeft: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px] text-muted-foreground">右刻度</Label>
                      <Input
                        inputMode="numeric"
                        value={form.scaleRight ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, scaleRight: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">攻击力（留空为 ?）</Label>
                  <Input
                    inputMode="numeric"
                    value={form.atk}
                    onChange={(e) => setForm((f) => ({ ...f, atk: e.target.value }))}
                    className="h-7 text-xs"
                  />
                </div>

                {isLink ? (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">连接值</Label>
                    <Input
                      inputMode="numeric"
                      value={form.level}
                      onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">守备力（留空为 ?）</Label>
                    <Input
                      inputMode="numeric"
                      value={form.def}
                      onChange={(e) => setForm((f) => ({ ...f, def: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {isLink && (
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">连接箭头（至少一个）</Label>
                <div className="grid grid-cols-3 gap-1 w-fit">
                  {LINK_ARROW_GRID.flat().map((cell) =>
                    cell === null ? (
                      <button
                        key="clear-cell"
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, markers: 0 }))}
                        disabled={form.markers === 0}
                        title="清空已选箭头"
                        className={cn(
                          'w-8 h-8 rounded border text-[10px] font-semibold transition-colors',
                          form.markers === 0
                            ? 'bg-secondary/40 text-muted-foreground/50 border-border cursor-not-allowed'
                            : 'bg-secondary/60 text-muted-foreground hover:text-foreground cursor-pointer'
                        )}
                      >
                        清空
                      </button>
                    ) : (
                      <button
                        key={cell.mask}
                        type="button"
                        onClick={() => toggleMarker(cell.mask)}
                        className={cn(
                          'w-8 h-8 rounded border text-xs transition-colors',
                          (form.markers & cell.mask) !== 0
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {cell.label}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">效果文本</Label>
            <Textarea
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              className="min-h-20 text-xs resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground shrink-0">引擎脚本</span>
                <span className="truncate font-mono text-[11px] text-foreground/80">
                  {editingId === null
                    ? '保存后可用'
                    : scriptInfo?.exists
                      ? `${scriptInfo.fileName}（${formatScriptSize(scriptInfo.size)}）`
                      : '未配置'}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="gap-1"
                  disabled={editingId === null || scriptBusy}
                  onClick={() => void handlePickScript()}
                >
                  <FileCode2 className="w-3 h-3" />
                  <span>{scriptInfo?.exists ? '替换 Lua' : '导入 Lua'}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="gap-1"
                  disabled={!scriptInfo?.exists || scriptBusy}
                  onClick={() => void handleRemoveScript()}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>移除</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="gap-1"
                  onClick={() => void window.api.openCustomCardScriptDir()}
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>目录</span>
                </Button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {editingId === null
                ? '保存这张卡后，可在自建卡脚本目录放置 c<卡密>.lua 让引擎执行它的效果。'
                : scriptInfo?.exists
                  ? '引擎会加载该脚本，这张卡按脚本效果参与对局。'
                  : '没有脚本时，这张卡在引擎里按白板卡参与对局：召唤、盖放、战斗、墓地/除外规则都正常，只是效果不发生。'}
              {' 脚本放在自建卡脚本目录（游戏目录下的脚本同样会被读取）。'}
            </p>
          </div>
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
            title={isLink && form.markers === 0 ? '连接怪兽需要至少一个箭头' : undefined}
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
