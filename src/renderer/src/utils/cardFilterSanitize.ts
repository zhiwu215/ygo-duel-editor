import { CardSearchFilterOptions, CardType, FILTER_CATALOGS, poolOptions } from '@shared/index'
import type { CardSearchFilters } from '../stores/useCardSearchStore'

export function sanitizeFilters(
  filters: CardSearchFilters,
  options: CardSearchFilterOptions
): Partial<CardSearchFilters> {
  const catalog = FILTER_CATALOGS[options.poolSchema]
  const subTypes =
    filters.type === CardType.SPELL
      ? catalog.spellSubTypes
      : filters.type === CardType.TRAP
        ? catalog.trapSubTypes
        : catalog.monsterSubTypes
  const poolIds: string[] = ['any', ...poolOptions(options.poolSchema).map((pool) => pool.id)]
  const patch: Partial<CardSearchFilters> = {}

  if (!catalog.mainTypes.some((o) => o.value === filters.type)) patch.type = 0
  if (!subTypes.some((o) => o.value === filters.subType)) patch.subType = 0
  if (!catalog.attributes.some((o) => o.value === filters.attribute)) patch.attribute = 0
  if (!catalog.races.some((o) => o.value === filters.race)) patch.race = 0
  if (!poolIds.includes(filters.cardPool)) patch.cardPool = 'any'
  if (options.poolSchema !== 'kcg' && !filters.showUnofficial) patch.showUnofficial = true

  return patch
}
