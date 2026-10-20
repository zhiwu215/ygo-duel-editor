/** 临时冒烟:真实游戏目录(E:/Edopro-kcg)的语言包发现 + 文本覆盖验证 */
import {
  currentBundledCdbPaths,
  currentLanguagePack,
  discoverGameLanguagePacks,
  readGameConfigLanguage
} from '../../src/main/services/gameContent'
import { cdbService } from '../../src/main/db/cdbService'

const gameDir = process.env.YGO_SMOKE_GAMEDIR || 'E:/Edopro-kcg'

async function main(): Promise<void> {
  process.env.YGO_SMOKE_GAMETYPE = 'ygopro'
  process.env.YGO_SMOKE_GAMEDIR = gameDir
  process.env.YGO_SMOKE_GAMELANG = 'Chs'

  const packs = discoverGameLanguagePacks(gameDir)
  const packIds = packs.map((p) => p.id).join(',')
  console.log('语言包:', packIds)
  if (packIds !== 'en,Chs,Cht,English') {
    console.error(`FAIL: 语言包发现错误: ${packIds}`)
    process.exit(1)
  }
  console.log('system.conf 默认语言:', readGameConfigLanguage(gameDir))
  const pack = currentLanguagePack()
  console.log('当前将加载:', pack?.id, pack?.cdbPaths.length ?? 0, '个语言包 cdb')
  if (pack?.id !== 'Chs' || pack.cdbPaths.length !== 10) {
    console.error('FAIL: 语言包解析错误')
    process.exit(1)
  }

  const cfg = { cdbPath: gameDir + '/cdb/cards.cdb' }
  const ok = cdbService.open(cfg.cdbPath, currentBundledCdbPaths(), [], pack)
  if (!ok) {
    console.error('FAIL: 卡库加载失败')
    process.exit(1)
  }
  console.log('加载的连接数:', cdbService.getLoadedPaths().length)
  const cards = cdbService.getCardsByIds([89631139, 511003096, 46986414])
  for (const id of [89631139, 511003096, 46986414]) {
    console.log(id, '->', cards[id]?.name ?? '(无)')
  }
  const tf = cdbService.search({ cardPool: 'tf' })
  console.log('TF 池总数:', tf.total)
  if (tf.total !== 512) {
    console.error(`FAIL: TF 池总数 ${tf.total} != 512 (游戏实测)`)
    cdbService.close()
    process.exit(1)
  }
  const blueEyes = cards[89631139]
  if (blueEyes?.name !== '青眼白龙') {
    console.error(`FAIL: 卡名覆盖失败: ${blueEyes?.name}`)
    cdbService.close()
    process.exit(1)
  }
  const speedWorld = cdbService.search({ keyword: 'Speed World' })
  console.log(
    '关键词 Speed World 命中:',
    speedWorld.total,
    '(隐藏位卡 Speed World 1/2 应被排除,命中来自 Neo/Gate Blocker 的文本)'
  )
  cdbService.close()
  console.log('[real-language-smoke] OK')
}

main().catch((err) => {
  console.error('ERROR:', err)
  process.exit(1)
})
