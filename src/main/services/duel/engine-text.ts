import { CardLocation, LOCATION_NAMES } from '@shared/index'
import { cdbService } from '../../db/cdbService'

export type TextArg = string | number

const MAX_SYSTEM_STRING_ID = 0x7ff
const SYSTEM_STRING_LOCATION = 1000

function formatText(text: string, args: TextArg[]): string {
  let index = 0
  return text.replace(/\[%ls\]|\[%d\]|%ls|%d/g, (token) => {
    const value = args[index++]
    if (token === '%d' || token === '[%d]') return value === undefined ? '' : String(value)
    if (value === undefined || value === '') return '该卡'
    return `【${value}】`
  })
}

export function systemText(id: number, args: TextArg[] = []): string | undefined {
  const text = cdbService.getSystemString(id)
  return text ? formatText(text, args) : undefined
}

export function descText(desc: number, args: TextArg[] = []): string | undefined {
  const value = desc >>> 0
  if (value === 0) return undefined
  if (value <= MAX_SYSTEM_STRING_ID) return systemText(value, args)
  const text = cdbService.getCardDescText(value)
  return text && text.trim() ? text : undefined
}

export function cardName(code: number): string | undefined {
  return code > 0 ? (cdbService.getCardById(code)?.name ?? undefined) : undefined
}

export function locationText(location: number, sequence = 0): string | undefined {
  if (location === CardLocation.SZONE) {
    const text = systemText(sequence < 5 ? 1003 : sequence === 5 ? 1008 : 1009)
    return text ?? LOCATION_NAMES[location]
  }
  let bit = -1
  for (let index = 0; index < 10; index++) {
    if ((1 << index) === location) {
      bit = index
      break
    }
  }
  const text = bit === -1 ? undefined : systemText(SYSTEM_STRING_LOCATION + bit)
  return text ?? LOCATION_NAMES[location]
}

export function counterText(id: number): string {
  return cdbService.getCounterName(id) ?? `指示物 #${id}`
}
