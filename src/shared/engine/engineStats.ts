import { CardLocation, isPendulumZoneSlot } from '../constants/locations'
import { CardUtils } from '../types/card'
import type { EngineCard } from '../types/duelEngine'

interface EngineCardStats {
  customAtk?: number
  customDef?: number
  customLevel?: number
  customLScale?: number
  customRScale?: number
}

export function resolveEngineStarLevel(ec: EngineCard): number | undefined {
  const cdb = ec.card
  if (!cdb || !CardUtils.isMonster(cdb.type) || CardUtils.isLink(cdb.type)) return undefined
  const engineLevel = ec.rank !== undefined && ec.rank > 0 ? ec.rank : ec.level
  if (engineLevel === undefined || engineLevel <= 0) return undefined
  const star = CardUtils.getStarLevel(engineLevel)
  return star === CardUtils.getStarLevel(cdb.level) ? undefined : star
}

function resolveMonsterZoneStats(ec: EngineCard): EngineCardStats {
  const cdb = ec.card!
  return {
    customAtk: ec.atk !== undefined && (cdb.atk < 0 || ec.atk !== cdb.atk) ? ec.atk : undefined,
    customDef:
      ec.def !== undefined && !CardUtils.isLink(cdb.type) && (cdb.def < 0 || ec.def !== cdb.def)
        ? ec.def
        : undefined,
    customLevel: resolveEngineStarLevel(ec)
  }
}

function resolvePendulumZoneScales(ec: EngineCard): EngineCardStats | null {
  const cdb = ec.card
  if (!cdb || !CardUtils.isPendulum(cdb.type)) return null
  if (!isPendulumZoneSlot(ec.location, ec.sequence)) return null

  const base = CardUtils.getPendulumScales(cdb.level)
  const lscale = ec.lscale
  const rscale = ec.rscale
  return {
    customLScale: lscale !== undefined && lscale !== base.lscale ? lscale : undefined,
    customRScale: rscale !== undefined && rscale !== base.rscale ? rscale : undefined
  }
}

export function resolveEngineCardStats(ec: EngineCard): EngineCardStats | null {
  if (!ec.card) return null
  if (ec.location === CardLocation.MZONE) return resolveMonsterZoneStats(ec)
  return resolvePendulumZoneScales(ec)
}
