import React from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import type { CustomCardEditorForm } from '../../utils/customCardForm'
import {
  ABILITY_OPTIONS,
  KIND_OPTIONS,
  SPELL_SUBTYPE_OPTIONS,
  SUMMON_OPTIONS,
  TRAP_SUBTYPE_OPTIONS,
  getCardKind,
  getMonsterSummon,
  getSpellSubtype,
  getTrapSubtype,
  hasEffect,
  hasLink,
  hasNormal,
  hasPendulum,
  isMainDeckMonster,
  setCardKind,
  setMonsterEffect,
  setMonsterForm,
  setMonsterSummon,
  setSpellSubtype,
  setTrapSubtype,
  toggleAbility,
  togglePendulum
} from '../../utils/customCardType'

interface CardKindFieldsProps {
  form: CustomCardEditorForm
  setForm: React.Dispatch<React.SetStateAction<CustomCardEditorForm>>
}

const ChoiceChip: React.FC<{
  active: boolean
  children: React.ReactNode
  onClick: () => void
}> = ({ active, children, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'h-7 rounded-md border px-2.5 text-[11px] font-medium transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground'
    )}
  >
    {children}
  </button>
)

export const CardKindFields: React.FC<CardKindFieldsProps> = ({ form, setForm }) => {
  const type = form.type
  const kind = getCardKind(type)
  const isMonster = kind === 'monster'
  const isLink = isMonster && hasLink(type)
  const isPendulum = isMonster && hasPendulum(type)
  const summon = getMonsterSummon(type)
  const mainDeck = isMainDeckMonster(type)
  const spellSubtype = getSpellSubtype(type)
  const trapSubtype = getTrapSubtype(type)

  const updateType = (nextType: number): void => {
    setForm((current) => ({ ...current, type: nextType }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">主类型</Label>
        <div className="flex gap-1.5">
          {KIND_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={kind === option.value ? 'default' : 'secondary'}
              size="sm"
              className="h-7 px-3 text-[11px]"
              onClick={() => updateType(setCardKind(type, option.value))}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {isMonster && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Label className="w-16 shrink-0 text-[11px] text-muted-foreground">形态</Label>
            {mainDeck ? (
              <div className="flex gap-1.5">
                <ChoiceChip
                  active={hasNormal(type)}
                  onClick={() => updateType(setMonsterForm(type, 'normal'))}
                >
                  通常
                </ChoiceChip>
                <ChoiceChip
                  active={hasEffect(type) && !hasNormal(type)}
                  onClick={() => updateType(setMonsterForm(type, 'effect'))}
                >
                  效果
                </ChoiceChip>
              </div>
            ) : (
              <label className="flex items-center gap-1.5 text-[11px] text-foreground/85">
                <Checkbox
                  checked={hasEffect(type)}
                  onCheckedChange={(checked) =>
                    updateType(setMonsterEffect(type, checked === true))
                  }
                />
                <span>效果</span>
              </label>
            )}
            {!isLink && (
              <label className="ml-2 flex items-center gap-1.5 text-[11px] text-foreground/85">
                <Checkbox
                  checked={isPendulum}
                  onCheckedChange={() => updateType(togglePendulum(type))}
                />
                <span>灵摆</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Label className="w-16 shrink-0 text-[11px] text-muted-foreground">召唤方式</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUMMON_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  active={summon === option.value}
                  onClick={() => updateType(setMonsterSummon(type, option.value))}
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <Label className="w-16 shrink-0 pt-1 text-[11px] text-muted-foreground">能力</Label>
            <div className="flex flex-wrap gap-1.5">
              {ABILITY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.mask}
                  active={(type & option.mask) !== 0}
                  onClick={() => updateType(toggleAbility(type, option.mask))}
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>
          </div>

          {isLink && (
            <p className="text-[11px] text-muted-foreground">
              连接怪兽没有守备力，也不能是灵摆；连接值默认应与箭头数量一致。
            </p>
          )}
        </>
      )}

      {kind === 'spell' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Label className="w-16 shrink-0 text-[11px] text-muted-foreground">细分</Label>
          <div className="flex flex-wrap gap-1.5">
            {SPELL_SUBTYPE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.mask}
                active={spellSubtype === option.mask}
                onClick={() => updateType(setSpellSubtype(type, option.mask))}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
        </div>
      )}

      {kind === 'trap' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Label className="w-16 shrink-0 text-[11px] text-muted-foreground">细分</Label>
          <div className="flex flex-wrap gap-1.5">
            {TRAP_SUBTYPE_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.mask}
                active={trapSubtype === option.mask}
                onClick={() => updateType(setTrapSubtype(type, option.mask))}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
