import { existsSync } from 'fs'
import { join } from 'path'
import { CardType, CustomCard, unpackCardLevel } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { enabledExtraCdbPaths } from './gameContent'
import { imageService } from './imageService'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']

let cachedImageDirs: { key: string; dirs: string[] } | null = null

function extraImageDirs(): string[] {
  const extraPaths = enabledExtraCdbPaths()
  const key = extraPaths.join('|')
  if (cachedImageDirs && cachedImageDirs.key === key) return cachedImageDirs.dirs
  const dirs: string[] = []
  for (const cdbPath of extraPaths) {
    for (const dir of imageService.detectPicsDirsFromCdb(cdbPath)) {
      if (!dirs.includes(dir)) dirs.push(dir)
    }
  }
  cachedImageDirs = { key, dirs }
  return dirs
}

function setcodeSlots(value: bigint | number): number[] {
  const raw = BigInt.asUintN(64, typeof value === 'bigint' ? value : BigInt(Math.trunc(value)))
  return Array.from({ length: 4 }, (_, index) => Number((raw >> BigInt(index * 16)) & 0xffffn))
}

export function importableCard(id: number): CustomCard | null {
  const card = cdbService.getCardById(id)
  if (!card) return null
  const { level, lscale, rscale } = unpackCardLevel(card.level)
  const isLink = (card.type & CardType.LINK) !== 0
  return {
    schemaVersion: 2,
    id: card.id,
    alias: card.alias,
    ot: card.ot,
    setcode: setcodeSlots(card.setcode),
    type: card.type,
    attribute: card.attribute,
    race: card.race,
    level,
    lscale,
    rscale,
    atk: card.atk,
    def: isLink ? 0 : card.def,
    linkMarkers: isLink ? card.def : 0,
    category: Number(card.category),
    name: card.name,
    desc: card.desc,
    strings: [],
    createdAt: 0,
    updatedAt: 0
  }
}

export function findExternalCardImage(id: number): string | null {
  for (const dir of extraImageDirs()) {
    for (const ext of IMAGE_EXTENSIONS) {
      const file = join(dir, `${id}${ext}`)
      if (existsSync(file)) return file
    }
  }
  return null
}
