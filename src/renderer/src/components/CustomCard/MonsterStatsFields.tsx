import React from 'react'
import { ATTRIBUTE_NAMES, RACE_NAMES } from '@shared/index'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { CustomCardEditorForm } from '../../utils/customCardForm'
import { getCardKind, getLevelLabel, hasLink, hasPendulum } from '../../utils/customCardType'
import { LinkArrowGrid } from './LinkArrowGrid'

interface MonsterStatsFieldsProps {
  form: CustomCardEditorForm
  setForm: React.Dispatch<React.SetStateAction<CustomCardEditorForm>>
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    {children}
  </div>
)

export const MonsterStatsFields: React.FC<MonsterStatsFieldsProps> = ({ form, setForm }) => {
  const type = form.type
  if (getCardKind(type) !== 'monster') return null
  const isLink = hasLink(type)
  const isPendulum = hasPendulum(type)

  const update = (patch: Partial<CustomCardEditorForm>): void => {
    setForm((current) => ({ ...current, ...patch }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="属性">
          <Select
            value={String(form.attribute)}
            onValueChange={(value) => update({ attribute: Number(value) })}
          >
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
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
        </Field>

        <Field label="种族">
          <Select
            value={String(form.race)}
            onValueChange={(value) => update({ race: Number(value) })}
          >
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
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
        </Field>

        <Field label={getLevelLabel(type)}>
          <Input
            value={form.level}
            onChange={(event) => update({ level: event.target.value })}
            inputMode="numeric"
            className="h-8 text-xs"
          />
        </Field>

        <Field label="攻击力">
          <Input
            value={form.atk}
            onChange={(event) => update({ atk: event.target.value })}
            inputMode="numeric"
            placeholder="?"
            className="h-8 text-xs"
          />
        </Field>

        {!isLink && (
          <Field label="守备力">
            <Input
              value={form.def}
              onChange={(event) => update({ def: event.target.value })}
              inputMode="numeric"
              placeholder="?"
              className="h-8 text-xs"
            />
          </Field>
        )}

        {isPendulum && (
          <>
            <Field label="左刻度">
              <Input
                value={form.scaleLeft}
                onChange={(event) => update({ scaleLeft: event.target.value })}
                inputMode="numeric"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="右刻度">
              <Input
                value={form.scaleRight}
                onChange={(event) => update({ scaleRight: event.target.value })}
                inputMode="numeric"
                className="h-8 text-xs"
              />
            </Field>
          </>
        )}
      </div>

      {isLink && (
        <LinkArrowGrid
          markers={form.markers}
          onToggleMarker={(mask) =>
            update({
              markers: (form.markers & mask) !== 0 ? form.markers & ~mask : form.markers | mask
            })
          }
          onClear={() => update({ markers: 0 })}
        />
      )}

      {isLink && (
        <p className="text-[11px] text-muted-foreground">
          连接值应与已选箭头数量一致；守备力不适用于连接怪兽。
        </p>
      )}
    </div>
  )
}
