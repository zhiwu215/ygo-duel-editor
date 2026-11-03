export const CARD_SEARCH_DRAG_TYPE = 'application/x-ygo-card-search'

export const hasCardDragData = (types: readonly string[]): boolean =>
  types.includes('application/json') || types.includes('text/instanceid')
