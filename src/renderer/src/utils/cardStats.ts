import { FieldCard, isInfiniteVal } from '@shared/index'

export interface EffectiveStats {
  origAtk: number
  origDef: number
  atk: number
  def: number
  isAtkInf: boolean
  isDefInf: boolean
  atkDiff: number
  defDiff: number
}

export function getEffectiveStats(card: FieldCard): EffectiveStats {
  const cdb = card.card
  const origAtk = cdb?.atk ?? 0
  const origDef = cdb?.def ?? 0
  const customAtk = card.customAtk
  const customDef = card.customDef
  const isAtkInf = isInfiniteVal(customAtk)
  const isDefInf = isInfiniteVal(customDef)
  return {
    origAtk,
    origDef,
    atk: customAtk ?? origAtk,
    def: customDef ?? origDef,
    isAtkInf,
    isDefInf,
    atkDiff:
      customAtk !== undefined && origAtk >= 0 ? (isAtkInf ? Infinity : customAtk - origAtk) : 0,
    defDiff:
      customDef !== undefined && origDef >= 0 ? (isDefInf ? Infinity : customDef - origDef) : 0
  }
}
