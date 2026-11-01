import { CardLocation } from '../constants/locations'
import { CardUtils } from '../types/card'
import type { EngineCard } from '../types/duelEngine'

interface EngineCardStats {
  customAtk?: number
  customDef?: number
  customLevel?: number
}

export function resolveEngineStarLevel(ec: EngineCard): number | undefined {
  const cdb = ec.card
  if (!cdb || !CardUtils.isMonster(cdb.type) || CardUtils.isLink(cdb.type)) return undefined
  const engineLevel = ec.rank !== undefined && ec.rank > 0 ? ec.rank : ec.level
  if (engineLevel === undefined || engineLevel <= 0) return undefined
  const star = CardUtils.getStarLevel(engineLevel)
  return star === CardUtils.getStarLevel(cdb.level) ? undefined : star
}

export function resolveEngineCardStats(ec: EngineCard): EngineCardStats | null {
  const cdb = ec.card
  if (!cdb || ec.location !== CardLocation.MZONE) return null
  const atkBase = cdb.atk >= 0 ? cdb.atk : ec.baseAtk
  const defBase = cdb.def >= 0 ? cdb.def : ec.baseDef
  return {
    customAtk: ec.atk !== undefined && ec.atk !== atkBase ? ec.atk : undefined,
    customDef:
      ec.def !== undefined && !CardUtils.isLink(cdb.type) && ec.def !== defBase
        ? ec.def
        : undefined,
    customLevel: resolveEngineStarLevel(ec)
  }
}
