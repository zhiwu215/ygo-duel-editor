import { Answer, CardLocation, EngineCardRef, FieldCard } from '@shared/index'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  History,
  Layers,
  RotateCw,
  Sparkles,
  Swords,
  Trash2,
  Zap
} from 'lucide-react'
import type { CardEngineActions } from './engineActions'
import { resolveCardName } from './cardNames'
import { buildCardEngineActionMap } from './cardMenuActions'

export interface MenuItemConfig {
  icon: LucideIcon
  iconClassName: string
  label: string
  action: () => void
  variant?: 'default' | 'destructive'
}

export interface CardMenuEditTarget {
  ref: EngineCardRef
  name: string
  code: number
}

export interface CardMenuItemContext {
  card: FieldCard
  isEngine: boolean
  engineActions: CardEngineActions | null
  act: (fn: () => void) => () => void
  submitAnswer: (answer: Answer) => void
  openProvenance: (target: CardMenuEditTarget) => void
  openReplace: (target: CardMenuEditTarget) => void
  removeEngineCard: (ref: EngineCardRef) => void
}

export function isPileLocation(location: number): boolean {
  return (
    location === CardLocation.EXTRA ||
    location === CardLocation.DECK ||
    location === CardLocation.GRAVE ||
    location === CardLocation.REMOVED
  )
}

export function isSpellTrapLocation(location: number): boolean {
  return (
    location === CardLocation.SZONE ||
    location === CardLocation.FZONE ||
    location === CardLocation.PZONE
  )
}

export function buildDuelActionItems(ctx: CardMenuItemContext): MenuItemConfig[] {
  const items: MenuItemConfig[] = []
  if (!ctx.engineActions) return items

  const addItem = (
    icon: LucideIcon,
    iconClassName: string,
    label: string,
    answer: Answer
  ): void => {
    items.push({
      icon,
      iconClassName,
      label,
      action: ctx.act(() => {
        ctx.submitAnswer(answer)
      })
    })
  }

  const actionMap = buildCardEngineActionMap(ctx.engineActions, ctx.card.position)
  if (actionMap.summon) {
    addItem(Sparkles, 'w-3.5 h-3.5 text-blue-400', actionMap.summon.label, actionMap.summon.answer)
  }
  if (actionMap.spSummon) {
    addItem(
      Sparkles,
      'w-3.5 h-3.5 text-blue-400',
      actionMap.spSummon.label,
      actionMap.spSummon.answer
    )
  }
  if (actionMap.set) {
    addItem(RotateCw, 'w-3.5 h-3.5 text-emerald-400', actionMap.set.label, actionMap.set.answer)
  }
  for (const spec of actionMap.activate) {
    addItem(Zap, 'w-3.5 h-3.5 text-amber-500', spec.label, spec.answer)
  }
  if (actionMap.repos) {
    addItem(RotateCw, 'w-3.5 h-3.5 text-emerald-400', actionMap.repos.label, actionMap.repos.answer)
  }
  if (actionMap.attack) {
    addItem(Swords, 'w-3.5 h-3.5 text-rose-500', actionMap.attack.label, actionMap.attack.answer)
  }
  if (actionMap.chain) {
    addItem(Layers, 'w-3.5 h-3.5 text-teal-400', actionMap.chain.label, actionMap.chain.answer)
  }
  return items
}

export function buildEngineEditItems(ctx: CardMenuItemContext): MenuItemConfig[] {
  if (!ctx.isEngine) return []

  const ref: EngineCardRef = {
    controller: ctx.card.controller,
    location: ctx.card.location,
    sequence: ctx.card.sequence,
    instanceId: ctx.card.instanceId
  }
  const target: CardMenuEditTarget = {
    ref,
    name: resolveCardName(ctx.card.code),
    code: ctx.card.code
  }

  return [
    {
      icon: History,
      iconClassName: 'w-3.5 h-3.5 text-sky-400',
      label: '查看来源',
      action: ctx.act(() => {
        void ctx.openProvenance(target)
      })
    },
    {
      icon: ArrowLeftRight,
      iconClassName: 'w-3.5 h-3.5 text-blue-400',
      label: '替换为…',
      action: ctx.act(() => ctx.openReplace(target))
    },
    {
      icon: Trash2,
      iconClassName: 'w-3.5 h-3.5',
      label: '从对局中移除（剧情）',
      variant: 'destructive',
      action: ctx.act(() => {
        void ctx.removeEngineCard(ref)
      })
    }
  ]
}
