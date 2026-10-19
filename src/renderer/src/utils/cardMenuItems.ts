import { Answer, CardLocation, CardPosition, EngineCardRef, FieldCard } from '@shared/index'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  History,
  Layers,
  RotateCw,
  Shield,
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
  stagingActive: boolean
  engineActions: CardEngineActions | null
  act: (fn: () => void) => () => void
  updateCardPosition: (instanceId: string, position: number) => void
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

const canEditLocally = (ctx: CardMenuItemContext): boolean => !ctx.isEngine || ctx.stagingActive

export function buildHandItems(ctx: CardMenuItemContext): MenuItemConfig[] {
  if (!canEditLocally(ctx) || ctx.card.location !== CardLocation.HAND) return []

  const setPos = (pos: number): (() => void) =>
    ctx.act(() => ctx.updateCardPosition(ctx.card.instanceId, pos))

  return [
    {
      icon: Eye,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '表侧表示 (公开手牌)',
      action: setPos(CardPosition.FACEUP)
    },
    {
      icon: EyeOff,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '里侧表示 (未公开手牌)',
      action: setPos(CardPosition.FACEDOWN)
    }
  ]
}

export function buildMonsterItems(ctx: CardMenuItemContext): MenuItemConfig[] {
  if (!canEditLocally(ctx) || ctx.card.location !== CardLocation.MZONE) return []

  const setPos = (pos: number): (() => void) =>
    ctx.act(() => ctx.updateCardPosition(ctx.card.instanceId, pos))

  return [
    {
      icon: Swords,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '表侧攻击表示',
      action: setPos(CardPosition.FACEUP_ATTACK)
    },
    {
      icon: Shield,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '表侧守备表示',
      action: setPos(CardPosition.FACEUP_DEFENSE)
    },
    {
      icon: EyeOff,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '里侧守备表示',
      action: setPos(CardPosition.FACEDOWN_DEFENSE)
    }
  ]
}

export function buildSpellTrapItems(ctx: CardMenuItemContext): MenuItemConfig[] {
  if (!canEditLocally(ctx) || !isSpellTrapLocation(ctx.card.location)) return []

  const setPos = (pos: number): (() => void) =>
    ctx.act(() => ctx.updateCardPosition(ctx.card.instanceId, pos))

  return [
    {
      icon: Swords,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '表侧表示',
      action: setPos(CardPosition.FACEUP_ATTACK)
    },
    {
      icon: RotateCw,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '里侧盖放',
      action: setPos(CardPosition.FACEDOWN)
    }
  ]
}

export function buildDeckPileItems(ctx: CardMenuItemContext): MenuItemConfig[] {
  if (ctx.card.location !== CardLocation.EXTRA && ctx.card.location !== CardLocation.DECK) {
    return []
  }

  const setPos = (pos: number): (() => void) =>
    ctx.act(() => ctx.updateCardPosition(ctx.card.instanceId, pos))

  return [
    {
      icon: Eye,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '表侧表示',
      action: setPos(CardPosition.FACEUP)
    },
    {
      icon: EyeOff,
      iconClassName: 'w-3.5 h-3.5 text-muted-foreground',
      label: '里侧表示',
      action: setPos(CardPosition.FACEDOWN)
    }
  ]
}
