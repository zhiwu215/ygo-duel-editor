import {
  CardLocation,
  CardPosition,
  CardType,
  CardUtils,
  FieldCard,
  EnginePendingAction,
  EngineActionOption,
  isCardMatchingEngineOption
} from '@shared/index'

export interface CardActionOptions {
  canSummon: boolean
  canSpSummon: boolean
  canMonsterSet: boolean
  canSpellSet: boolean
  canActivate: boolean
  activateOptions: { desc?: number; descText?: string; effectIndex?: number; optionId?: string }[]
  canChain: boolean
  chainOptions: { desc?: number; descText?: string; optionId: string }[]
  canRepos: boolean
  canAttack: boolean
  hasAnyAction: boolean
}

export function enginePromptUsesModal(prompt: EnginePendingAction | null): boolean {
  if (!prompt) return false
  if (
    prompt.kind === 'SELECT_YESNO' ||
    prompt.kind === 'SELECT_EFFECTYN' ||
    prompt.kind === 'SELECT_OPTION' ||
    prompt.kind === 'SELECT_POSITION' ||
    prompt.kind === 'ANNOUNCE'
  ) {
    return true
  }
  if (prompt.kind === 'SELECT_CARD' || prompt.kind === 'SELECT_TRIBUTE') {
    return prompt.options.some(
      (opt) =>
        opt.location === CardLocation.DECK ||
        opt.location === CardLocation.EXTRA ||
        opt.location === CardLocation.GRAVE ||
        opt.location === CardLocation.REMOVED
    )
  }
  return false
}

export function getFallbackActions(card: FieldCard): CardActionOptions {
  const cdb = card.card
  const isMonster = cdb ? CardUtils.isMonster(cdb.type) : card.location === CardLocation.MZONE
  const isHand = card.location === CardLocation.HAND
  const isField =
    card.location === CardLocation.MZONE ||
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE
  const isPile =
    card.location === CardLocation.GRAVE ||
    card.location === CardLocation.REMOVED ||
    card.location === CardLocation.EXTRA

  let canSummon = false
  let canSpSummon = false
  let canMonsterSet = false
  let canSpellSet = false
  let canActivate = false
  let canRepos = false
  let canAttack = false

  if (isHand) {
    if (isMonster) {
      canSummon = true
      canSpSummon = true
      canMonsterSet = true
      canActivate = cdb ? (cdb.type & CardType.EFFECT) !== 0 : false
    } else {
      canActivate = true
      canSpellSet = true
    }
  } else if (isField) {
    if (isMonster) {
      canRepos = true
      canAttack = card.position !== CardPosition.FACEDOWN_DEFENSE
      canActivate = cdb ? (cdb.type & CardType.EFFECT) !== 0 : false
    } else {
      canActivate = true
    }
  } else if (isPile) {
    canSpSummon = isMonster
    canActivate = true
  }

  const hasAnyAction =
    canSummon || canSpSummon || canMonsterSet || canSpellSet || canActivate || canRepos || canAttack

  return {
    canSummon,
    canSpSummon,
    canMonsterSet,
    canSpellSet,
    canActivate,
    activateOptions: [],
    canChain: false,
    chainOptions: [],
    canRepos,
    canAttack,
    hasAnyAction
  }
}

export function getActionsFromEngine(
  card: FieldCard,
  engineOptions: EngineActionOption[]
): CardActionOptions {
  const matching = engineOptions.filter((opt) => isCardMatchingEngineOption(card, opt))

  const canSummon = matching.some((o) => o.type === 'SUMMON')
  const canSpSummon = matching.some((o) => o.type === 'SPSUMMON')
  const canMonsterSet = matching.some((o) => o.type === 'MSET')
  const canSpellSet = matching.some((o) => o.type === 'SSET')
  const activateOpts = matching.filter((o) => o.type === 'ACTIVATE')
  const canActivate = activateOpts.length > 0
  const chainOpts = matching.filter((o) => o.type === 'CHAIN')
  const canChain = chainOpts.length > 0
  const canRepos = matching.some((o) => o.type === 'REPOS')
  const canAttack = matching.some((o) => o.type === 'ATTACK')
  const hasAnyAction =
    canSummon ||
    canSpSummon ||
    canMonsterSet ||
    canSpellSet ||
    canActivate ||
    canChain ||
    canRepos ||
    canAttack

  return {
    canSummon,
    canSpSummon,
    canMonsterSet,
    canSpellSet,
    canActivate,
    activateOptions: activateOpts.map((o) => ({
      desc: o.cardCode,
      descText: o.label,
      optionId: o.id
    })),
    canChain,
    chainOptions: chainOpts.map((o) => ({
      desc: o.cardCode,
      descText: o.label,
      optionId: o.id
    })),
    canRepos,
    canAttack,
    hasAnyAction
  }
}
