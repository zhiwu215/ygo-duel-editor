import { CardLocation, CardPosition, CardType, CardUtils, FieldCard } from '@shared/index'

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
