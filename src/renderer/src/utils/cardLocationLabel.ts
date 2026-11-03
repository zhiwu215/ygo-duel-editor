import { CardLocation, FIELD_ZONE_SEQUENCE, LOCATION_NAMES } from '@shared/index'

export function cardLocationLabel(location: number, sequence: number): string {
  const index = sequence + 1
  if (location === CardLocation.SZONE) {
    if (sequence === FIELD_ZONE_SEQUENCE) return `${LOCATION_NAMES[CardLocation.FZONE]}[${index}]`
    if (sequence > FIELD_ZONE_SEQUENCE) return `${LOCATION_NAMES[CardLocation.PZONE]}[${index}]`
  }
  return `${LOCATION_NAMES[location] ?? '未知区域'}[${index}]`
}
