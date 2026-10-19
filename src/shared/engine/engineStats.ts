import { CardLocation } from '../constants/locations'
import { CardUtils } from '../types/card'
import type { EngineCard } from '../types/duelEngine'

interface EngineCardStats {
  customAtk?: number
  customDef?: number
}

export function resolveEngineCardStats(ec: EngineCard): EngineCardStats | null {
  const cdb = ec.card
  if (!cdb || ec.location !== CardLocation.MZONE) return null
  const atkBase = cdb.atk >= 0 ? cdb.atk : ec.baseAtk
  const defBase = cdb.def >= 0 ? cdb.def : ec.baseDef
  return {
    customAtk: ec.atk !== undefined && ec.atk !== atkBase ? ec.atk : undefined,
    customDef:
      ec.def !== undefined && !CardUtils.isLink(cdb.type) && ec.def !== defBase ? ec.def : undefined
  }
}
