import { CdbCard, CardType } from './card'

export interface CustomCard {
  id: number
  name: string
  desc: string
  type: number
  attribute: number
  race: number
  level: number
  atk: number
  def: number
  createdAt: number
  updatedAt: number
}

export interface CustomCardInput {
  id?: number
  name: string
  desc: string
  type: number
  attribute: number
  race: number
  level: number
  atk: number
  def: number
  imageSourcePath?: string
}

export const CUSTOM_CARD_ID_MIN = 900000000
export const CUSTOM_CARD_ID_MAX = 999999999

export function isCustomCardId(id: number | undefined | null): boolean {
  return (
    typeof id === 'number' &&
    Number.isFinite(id) &&
    id >= CUSTOM_CARD_ID_MIN &&
    id <= CUSTOM_CARD_ID_MAX
  )
}

export function customCardToCdbCard(card: CustomCard): CdbCard {
  const isLink = (card.type & CardType.LINK) !== 0
  return {
    id: card.id,
    ot: 0,
    alias: 0,
    setcode: 0,
    type: card.type,
    atk: card.atk,
    def: card.def,
    level: card.level,
    race: card.race,
    attribute: card.attribute,
    category: 0,
    name: card.name,
    desc: card.desc,
    isCustom: true,
    markers: isLink && card.def > 0 && card.def <= 0xff ? card.def : undefined
  }
}
