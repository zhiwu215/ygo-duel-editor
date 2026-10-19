import React from 'react'
import { ATTRIBUTE_NAMES, RACE_NAMES } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { CustomCardEditorForm } from '../../stores/useCustomCardStore'
import { CardType } from '@shared/index'
import { MONSTER_SUBTYPES, SPELL_SUBTYPES, TRAP_SUBTYPES } from '../../utils/customCardType'

const KINDS: Array<{ id: number; label: string }> = [
  { id: CardType.MONSTER, label: '怪兽' },
  { id: CardType.SPELL, label: '魔法' },
  { id: CardType.TRAP, label: '陷阱' }
]

interface TypeFieldsProps {
  form: CustomCardEditorForm
  editingId: number | null
  kind: number
  isMonster: boolean
  isSpell: boolean
  isTrap: boolean
  isLink: boolean
  isPendulum: boolean
  setForm: React.Dispatch<React.SetStateAction<CustomCardEditorForm>>
  onSetKind: (kindId: number) => void
  onToggleSub: (mask: number, mutual?: number[]) => void
  onSetSpellSub: (value: string | null) => void
  onSetTrapSub: (value: string | null) => void
}

export const TypeFields: React.FC<TypeFieldsProps> = ({
  form,
  editingId,
  kind,
  isMonster,
  isSpell,
  isTrap,
  isLink,
  isPendulum,
  setForm,
  onSetKind,
  onToggleSub,
  onSetSpellSub,
  onSetTrapSub
}) => {
  const spellSubValue = SPELL_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.mask ?? 'none'
  const trapSubValue = TRAP_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.mask ?? 'none'
  const spellSubLabel = SPELL_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.label ?? '通常'
  const trapSubLabel = TRAP_SUBTYPES.find((s) => (form.type & s.mask) !== 0)?.label ?? '通常'

  return (
    <>
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
        <span className="font-mono text-foreground/80">{editingId ?? '保存后自动生成'}</span>
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
              onClick={() => onSetKind(k.id)}
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
                  onCheckedChange={() => onToggleSub(sub.mask, sub.mutual)}
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
          <Select value={String(spellSubValue)} onValueChange={(val) => onSetSpellSub(val)}>
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
          <Select value={String(trapSubValue)} onValueChange={(val) => onSetTrapSub(val)}>
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
    </>
  )
}
