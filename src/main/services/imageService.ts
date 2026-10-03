import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { configService } from './configService'
import { cdbService } from '../db/cdbService'

export class ImageService {
  /**
   * 根据选中的 cdb 路径或目录推断游戏根目录
   */
  public detectGameDirectory(targetPath: string): string | null {
    if (!targetPath) return null

    let dir = targetPath
    try {
      if (targetPath.endsWith('.cdb') || targetPath.endsWith('.exe')) {
        dir = dirname(targetPath)
      }

      // 1. 检查当前目录是否含有 pics 文件夹
      if (existsSync(join(dir, 'pics'))) {
        return dir
      }

      // 2. 检查父目录（例如 cards.cdb 放在 expansions/ 或 data/ 目录中的情况）
      const parentDir = dirname(dir)
      if (parentDir && parentDir !== dir && existsSync(join(parentDir, 'pics'))) {
        return parentDir
      }

      // 3. 检查当前目录是否含有 ygopro.exe / EDOPro.exe / cards.cdb
      if (
        existsSync(join(dir, 'cards.cdb')) ||
        existsSync(join(dir, 'ygopro.exe')) ||
        existsSync(join(dir, 'EDOPro.exe'))
      ) {
        return dir
      }
    } catch (err) {
      console.error('[ImageService] detectGameDirectory error:', err)
    }

    return null
  }

  /**
   * 获取所有可用的卡图搜索目录 (支持 pics 和 expansions/pics)
   */
  public getPicsDirectories(): string[] {
    const cfg = configService.get()
    const dirs: string[] = []

    const tryAddPicsDir = (baseDir: string | undefined): void => {
      if (!baseDir) return
      const p1 = join(baseDir, 'pics')
      if (existsSync(p1) && !dirs.includes(p1)) {
        dirs.push(p1)
      }
      const p2 = join(baseDir, 'expansions', 'pics')
      if (existsSync(p2) && !dirs.includes(p2)) {
        dirs.push(p2)
      }
    }

    // 1. 用户配置的游戏根目录
    if (cfg.gameDirectory) {
      tryAddPicsDir(cfg.gameDirectory)
    }

    // 2. 当前加载的 cards.cdb 所在目录及其父目录
    if (cfg.cdbPath) {
      const cdbDir = dirname(cfg.cdbPath)
      tryAddPicsDir(cdbDir)
      tryAddPicsDir(dirname(cdbDir))
    }

    return dirs
  }

  /**
   * 查找指定卡密的本地图片绝对路径
   * @param code 卡片密码
   * @param small 是否需要缩略图 (优先寻找 thumbnail/ 子目录)
   */
  public findCardImagePath(code: number, small = false): string | null {
    if (!code || code <= 0) return null

    const picsDirs = this.getPicsDirectories()
    if (picsDirs.length === 0) return null

    const findForCode = (id: number): string | null => {
      for (const dir of picsDirs) {
        const thumbJpg = join(dir, 'thumbnail', `${id}.jpg`)
        const thumbPng = join(dir, 'thumbnail', `${id}.png`)
        const fullJpg = join(dir, `${id}.jpg`)
        const fullPng = join(dir, `${id}.png`)

        if (small) {
          if (existsSync(thumbJpg)) return thumbJpg
          if (existsSync(thumbPng)) return thumbPng
          if (existsSync(fullJpg)) return fullJpg
          if (existsSync(fullPng)) return fullPng
        } else {
          if (existsSync(fullJpg)) return fullJpg
          if (existsSync(fullPng)) return fullPng
          if (existsSync(thumbJpg)) return thumbJpg
          if (existsSync(thumbPng)) return thumbPng
        }
      }
      return null
    }

    // 1. 优先按卡片本尊密码查找
    const directPath = findForCode(code)
    if (directPath) return directPath

    // 2. 若未找到，尝试通过 alias (同画/异画别名卡密) 查找
    if (cdbService.isReady()) {
      try {
        const cardMap = cdbService.getCardsByIds([code])
        const card = cardMap[code]
        if (card && card.alias && card.alias > 0 && card.alias !== code) {
          const aliasPath = findForCode(card.alias)
          if (aliasPath) return aliasPath
        }
      } catch (err) {
        console.error('[ImageService] alias lookup error:', err)
      }
    }

    return null
  }
}

export const imageService = new ImageService()
