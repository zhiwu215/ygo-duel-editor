import { CdbCard, CardType } from './card'

export interface CustomCard {
  schemaVersion: 2
  id: number
  alias: number
  ot: number
  setcode: number[]
  type: number
  attribute: number
  race: number
  level: number
  lscale: number
  rscale: number
  atk: number
  def: number
  linkMarkers: number
  category: number
  name: string
  desc: string
  strings: string[]
  createdAt: number
  updatedAt: number
}

export interface CustomCardInput {
  id?: number
  editingId?: number
  name: string
  desc: string
  type: number
  attribute: number
  race: number
  level: number
  lscale: number
  rscale: number
  atk: number
  def: number
  linkMarkers: number
  alias: number
  ot: number
  setcode: number[]
  category: number
  strings: string[]
  imageSourcePath?: string
  scriptSourcePath?: string
}

export const CUSTOM_CARD_ID_MIN = 900000000
export const CUSTOM_CARD_ID_MAX = 999999999

export function normalizeCardSetcode(value: unknown): number[] {
  const slots = Array.isArray(value) ? value : []
  return Array.from({ length: 4 }, (_, index) => {
    const numeric = Number(slots[index] ?? 0)
    return Number.isFinite(numeric) ? Math.max(0, Math.min(0xffff, Math.trunc(numeric))) : 0
  })
}

export function normalizeCardStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : []
  return Array.from({ length: 16 }, (_, index) => {
    const entry = values[index]
    return typeof entry === 'string' ? entry : ''
  })
}

export function packCardLevel(level: number, lscale: number, rscale: number): number {
  return ((level & 0xff) | ((rscale & 0xff) << 16) | ((lscale & 0xff) << 24)) >>> 0
}

export function unpackCardLevel(value: number): { level: number; lscale: number; rscale: number } {
  return {
    level: value & 0xff,
    lscale: (value >>> 24) & 0xff,
    rscale: (value >>> 16) & 0xff
  }
}

export function customCardToCdbCard(card: CustomCard): CdbCard {
  const isLink = (card.type & CardType.LINK) !== 0
  const setcode = card.setcode.reduce<bigint>(
    (acc, code, index) => acc | (BigInt(code & 0xffff) << BigInt(index * 16)),
    0n
  )
  return {
    id: card.id,
    ot: card.ot,
    alias: card.alias,
    setcode,
    type: card.type,
    atk: card.atk,
    def: isLink ? card.linkMarkers : card.def,
    level: packCardLevel(card.level, card.lscale, card.rscale),
    race: card.race,
    attribute: card.attribute,
    category: card.category,
    name: card.name,
    desc: card.desc,
    strings: normalizeCardStrings(card.strings),
    isCustom: true,
    markers: isLink ? card.linkMarkers : undefined
  }
}
