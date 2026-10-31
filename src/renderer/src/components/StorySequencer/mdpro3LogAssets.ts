import type { CSSProperties } from 'react'
import { CardLocation } from '@shared/index'
import arrow from '../../assets/log/arrow.png'
import chain from '../../assets/log/chain.png'
import controllerMe from '../../assets/log/controller-me.png'
import controllerOp from '../../assets/log/controller-op.png'
import fieldMagic from '../../assets/log/location-field-magic.png'
import grave from '../../assets/log/location-grave.png'
import hand from '../../assets/log/location-hand.png'
import extra from '../../assets/log/location-extra.png'
import deck from '../../assets/log/location-deck.png'
import overlay from '../../assets/log/location-overlay.png'
import removed from '../../assets/log/location-removed.png'
import myMzone0 from '../../assets/log/field/my-mzone-0.png'
import myMzone1 from '../../assets/log/field/my-mzone-1.png'
import myMzone2 from '../../assets/log/field/my-mzone-2.png'
import myMzone3 from '../../assets/log/field/my-mzone-3.png'
import myMzone4 from '../../assets/log/field/my-mzone-4.png'
import myMzone5 from '../../assets/log/field/my-mzone-5.png'
import myMzone6 from '../../assets/log/field/my-mzone-6.png'
import mySzone0 from '../../assets/log/field/my-szone-0.png'
import mySzone1 from '../../assets/log/field/my-szone-1.png'
import mySzone2 from '../../assets/log/field/my-szone-2.png'
import mySzone3 from '../../assets/log/field/my-szone-3.png'
import mySzone4 from '../../assets/log/field/my-szone-4.png'
import opMzone0 from '../../assets/log/field/op-mzone-0.png'
import opMzone1 from '../../assets/log/field/op-mzone-1.png'
import opMzone2 from '../../assets/log/field/op-mzone-2.png'
import opMzone3 from '../../assets/log/field/op-mzone-3.png'
import opMzone4 from '../../assets/log/field/op-mzone-4.png'
import opMzone5 from '../../assets/log/field/op-mzone-5.png'
import opMzone6 from '../../assets/log/field/op-mzone-6.png'
import opSzone0 from '../../assets/log/field/op-szone-0.png'
import opSzone1 from '../../assets/log/field/op-szone-1.png'
import opSzone2 from '../../assets/log/field/op-szone-2.png'
import opSzone3 from '../../assets/log/field/op-szone-3.png'
import opSzone4 from '../../assets/log/field/op-szone-4.png'

const fieldIcons: Record<string, string> = {
  'my-mzone-0': myMzone0,
  'my-mzone-1': myMzone1,
  'my-mzone-2': myMzone2,
  'my-mzone-3': myMzone3,
  'my-mzone-4': myMzone4,
  'my-mzone-5': myMzone5,
  'my-mzone-6': myMzone6,
  'my-szone-0': mySzone0,
  'my-szone-1': mySzone1,
  'my-szone-2': mySzone2,
  'my-szone-3': mySzone3,
  'my-szone-4': mySzone4,
  'op-mzone-0': opMzone0,
  'op-mzone-1': opMzone1,
  'op-mzone-2': opMzone2,
  'op-mzone-3': opMzone3,
  'op-mzone-4': opMzone4,
  'op-mzone-5': opMzone5,
  'op-mzone-6': opMzone6,
  'op-szone-0': opSzone0,
  'op-szone-1': opSzone1,
  'op-szone-2': opSzone2,
  'op-szone-3': opSzone3,
  'op-szone-4': opSzone4
}

function fieldIcon(name: string): string | undefined {
  return fieldIcons[name]
}

export const MDLOG_ASSETS = {
  arrow,
  chain
}

export const MDLOG_COLORS = {
  myArrow: '#0a86ff',
  opArrow: '#e11d48'
}

export interface MdLocationIcon {
  base: string
  controller?: string
}

function sidePrefix(controller: 0 | 1): string {
  return controller === 0 ? 'my' : 'op'
}

export function locationIcon(
  controller: 0 | 1,
  location: number,
  sequence: number
): MdLocationIcon | null {
  const side = sidePrefix(controller)
  if (location === CardLocation.FZONE || (location === CardLocation.SZONE && sequence === 5)) {
    return { base: fieldMagic, controller: controller === 0 ? controllerMe : controllerOp }
  }
  if (location === CardLocation.MZONE) {
    const index = sequence <= 6 ? sequence : 0
    const base = fieldIcon(`${side}-mzone-${index}`)
    return base ? { base } : null
  }
  if (location === CardLocation.SZONE) {
    const index = sequence <= 4 ? sequence : sequence === 6 ? 0 : 4
    const base = fieldIcon(`${side}-szone-${index}`)
    return base ? { base } : null
  }
  if (location === CardLocation.PZONE) {
    const base = fieldIcon(`${side}-szone-${sequence === 0 ? 0 : 4}`)
    return base ? { base } : null
  }
  const baseByLocation: Record<number, string> = {
    [CardLocation.HAND]: hand,
    [CardLocation.GRAVE]: grave,
    [CardLocation.DECK]: deck,
    [CardLocation.EXTRA]: extra,
    [CardLocation.REMOVED]: removed,
    [CardLocation.OVERLAY]: overlay
  }
  const base = baseByLocation[location]
  if (!base) return null
  return { base, controller: controller === 0 ? controllerMe : controllerOp }
}

export function maskStyle(url: string, color: string): CSSProperties {
  return {
    backgroundColor: color,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat'
  }
}
