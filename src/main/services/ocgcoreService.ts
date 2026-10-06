import { existsSync, readFileSync } from 'fs'
import path from 'path'
import createCore, {
  OcgCoreSync,
  OcgDuelMode,
  OcgLocation,
  OcgPosition,
  OcgCardData,
  OcgDuelHandle
} from 'ocgcore-wasm'
import { DuelPuzzleState, CardLocation, CardPosition } from '@shared/index'
import { cdbService } from '../db/cdbService'
import { configService } from './configService'

export class OcgcoreService {
  private core: OcgCoreSync | null = null

  private isInitializing: boolean = false

  public async getCore(): Promise<OcgCoreSync> {
    if (this.core) return this.core
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (this.core) return this.core
    }

    this.isInitializing = true
    try {
      this.core = await createCore({ sync: true })
      const [maj, min] = this.core.getVersion()
      console.log(`[OcgcoreService] ocgcore-wasm core initialized (v${maj}.${min})`)
      return this.core
    } finally {
      this.isInitializing = false
    }
  }

  public readScript(name: string): string | null {
    const cfg = configService.get()
    const gameDir = cfg.gameDirectory

    if (gameDir) {
      const fileName = name.endsWith('.lua') ? name : `${name}.lua`
      const fullPath = path.join(gameDir, 'script', fileName)

      if (existsSync(fullPath)) {
        try {
          return readFileSync(fullPath, 'utf-8')
        } catch (err) {
          console.error(`[OcgcoreService] Failed to read script ${fullPath}:`, err)
        }
      }
    }

    return '-- empty fallback script\nfunction initial_effect(c)\nend\n'
  }

  public readCardData(code: number): OcgCardData | null {
    const details = cdbService.getCardsByIds([code])
    const c = details[code]

    if (c) {
      const setcodes: number[] = []
      if (c.setcode) {
        let val = BigInt(c.setcode)
        for (let i = 0; i < 4; i++) {
          const chunk = Number(val & 0xffffn)
          if (chunk > 0) setcodes.push(chunk)
          val >>= 16n
        }
      }

      return {
        code: c.id,
        alias: c.alias || 0,
        setcodes,
        type: c.type || 0x11,
        level: (c.level || 1) & 0xff,
        attribute: c.attribute || 1,
        race: BigInt(c.race || 1),
        attack: c.atk || 0,
        defense: c.def || 0,
        lscale: ((c.level || 0) >> 24) & 0xff,
        rscale: ((c.level || 0) >> 16) & 0xff,
        link_marker: c.def || 0
      }
    }

    console.warn(`[OcgcoreService] Card data missing in database for code: ${code}`)
    return null
  }

  private mapLocation(loc: number): OcgLocation {
    switch (loc) {
      case CardLocation.DECK:
        return OcgLocation.DECK
      case CardLocation.HAND:
        return OcgLocation.HAND
      case CardLocation.MZONE:
        return OcgLocation.MZONE
      case CardLocation.SZONE:
      case CardLocation.FZONE:
        return OcgLocation.SZONE
      case CardLocation.GRAVE:
        return OcgLocation.GRAVE
      case CardLocation.REMOVED:
        return OcgLocation.REMOVED
      case CardLocation.EXTRA:
        return OcgLocation.EXTRA
      case CardLocation.PZONE:
        return OcgLocation.PZONE
      default:
        return OcgLocation.DECK
    }
  }

  private mapPosition(pos: number): OcgPosition {
    switch (pos) {
      case CardPosition.FACEUP_ATTACK:
        return OcgPosition.FACEUP_ATTACK
      case CardPosition.FACEDOWN_ATTACK:
        return OcgPosition.FACEDOWN_ATTACK
      case CardPosition.FACEUP_DEFENSE:
        return OcgPosition.FACEUP_DEFENSE
      case CardPosition.FACEDOWN_DEFENSE:
        return OcgPosition.FACEDOWN_DEFENSE
      default:
        return OcgPosition.FACEUP_ATTACK
    }
  }

  public async createDuelFromState(state: DuelPuzzleState): Promise<{
    handle: OcgDuelHandle | null
    core: OcgCoreSync
    cardCount: number
  }> {
    const core = await this.getCore()

    let ruleFlag = OcgDuelMode.MODE_MR5
    if (state.masterRule === 2) ruleFlag = OcgDuelMode.MODE_MR2
    else if (state.masterRule === 3) ruleFlag = OcgDuelMode.MODE_MR3
    else if (state.masterRule === 4) ruleFlag = OcgDuelMode.MODE_MR4

    const flags = ruleFlag | OcgDuelMode.PSEUDO_SHUFFLE

    const handle = await core.createDuel({
      flags,
      seed: [100n, 200n, 300n, 400n],
      team1: {
        startingLP: state.players[0]?.lp || 8000,
        startingDrawCount: 0,
        drawCountPerTurn: 1
      },
      team2: {
        startingLP: state.players[1]?.lp || 8000,
        startingDrawCount: 0,
        drawCountPerTurn: 1
      },
      cardReader: (code) => this.readCardData(code),
      scriptReader: (name) => this.readScript(name),
      errorHandler: (type, text) => {
        console.warn(`[OcgcoreService ${type}] ${text}`)
      }
    })

    if (!handle) {
      return { handle: null, core, cardCount: 0 }
    }

    let cardCount = 0
    for (const card of state.cards) {
      const ocgLoc = this.mapLocation(card.location)
      const ocgPos = this.mapPosition(card.position)

      await core.duelNewCard(handle, {
        team: card.controller,
        duelist: 0,
        code: card.code,
        controller: card.controller,
        location: ocgLoc,
        sequence: card.sequence,
        position: ocgPos
      })
      cardCount++
    }

    return { handle, core, cardCount }
  }
}

export const ocgcoreService = new OcgcoreService()
