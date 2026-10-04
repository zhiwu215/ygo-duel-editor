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
  // 懒加载，getCore() 进行初次实例化
  private core: OcgCoreSync | null = null
  // 防重入互斥锁
  private isInitializing: boolean = false

  /**
   * 确保并获取 ocgcore-wasm 核心实例
   */
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

  /**
   * 从用户配置的游戏目录按需读取卡片效果 Lua 脚本
   */
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

    // 若本地未找到或未配置游戏目录，返回安全空实现防崩溃
    return '-- empty fallback script\nfunction initial_effect(c)\nend\n'
  }

  /**
   * 从 cdbService 读取卡片属性数据并转换为 OcgCardData
   */
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

  /**
   * 将应用的 CardLocation 映射为 ocgcore-wasm 的 OcgLocation
   */
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

  /**
   * 将应用的 CardPosition 映射为 ocgcore-wasm 的 OcgPosition
   */
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

  /**
   * 根据决斗盘状态创建无头决斗实例 (彻底解除官方张数死锁，支持同人剧情自定义任意数量的手牌、卡组与额外卡组)
   */
  public async createDuelFromState(state: DuelPuzzleState): Promise<{
    handle: OcgDuelHandle | null
    core: OcgCoreSync
    cardCount: number
  }> {
    const core = await this.getCore()

    // 规则映射：默认 MR5，关闭自动洗牌以保证创作者编排的牌堆顺序
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

    // 逐张将场面上的卡牌注入引擎 (解除官方张数死锁，允许同人剧情自定义任意数量的卡牌)
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
