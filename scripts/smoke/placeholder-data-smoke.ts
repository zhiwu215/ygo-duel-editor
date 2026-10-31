/**
 * 占位卡数据一致性冒烟：
 * 引擎读到的占位卡数据必须与写进游戏卡库的占位卡一致，
 * 否则回放里按索引编码的应答会在游戏侧选中另一张卡（例如通常召唤成占位卡）。
 */
import {
  PLACEHOLDER_CARD_CODE,
  PLACEHOLDER_MONSTER_CARD_CODE,
  PLACEHOLDER_SPELL_TRAP_CARD_CODE,
  CardType,
  isPlaceholderCard
} from '@shared/index'
import { readEngineCardData } from '../../src/main/services/duel/card-reader'
import { placeholderGameCards } from '../../src/main/services/placeholderGameCards'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function main(): void {
  const gameCards = new Map(placeholderGameCards().map((card) => [card.id, card]))
  for (const code of [
    PLACEHOLDER_CARD_CODE,
    PLACEHOLDER_MONSTER_CARD_CODE,
    PLACEHOLDER_SPELL_TRAP_CARD_CODE
  ]) {
    assert(isPlaceholderCard(code), `${code} 应识别为占位卡`)
    const engine = readEngineCardData(code)
    const game = gameCards.get(code)
    assert(Boolean(engine), `${code} 引擎应能读到占位卡数据`)
    assert(Boolean(game), `${code} 游戏卡库应包含占位卡`)
    assert(engine!.type === game!.type, `${code} 类型不一致: ${engine!.type} vs ${game!.type}`)
    assert(
      engine!.level === (game!.level & 0xff),
      `${code} 等级不一致: ${engine!.level} vs ${game!.level}`
    )
    assert(
      engine!.attribute === game!.attribute,
      `${code} 属性不一致: ${engine!.attribute} vs ${game!.attribute}`
    )
    assert(engine!.race === game!.race, `${code} 种族不一致: ${engine!.race} vs ${game!.race}`)
    assert(
      engine!.attack === game!.atk && engine!.defense === game!.def,
      `${code} 攻守不一致: ${engine!.attack}/${engine!.defense} vs ${game!.atk}/${game!.def}`
    )
  }

  const neutral = readEngineCardData(PLACEHOLDER_CARD_CODE)!
  assert(neutral.type === 0, `未定占位卡应保持未定类型（可盖放到魔陷区），实际 ${neutral.type}`)
  assert(neutral.level === 0, `未定占位卡等级应为 0，实际 ${neutral.level}`)
  const monster = readEngineCardData(PLACEHOLDER_MONSTER_CARD_CODE)!
  assert(
    (monster.type & (CardType.MONSTER | CardType.NORMAL)) === (CardType.MONSTER | CardType.NORMAL),
    '怪兽占位卡应是通常怪兽'
  )
  const spellTrap = readEngineCardData(PLACEHOLDER_SPELL_TRAP_CARD_CODE)!
  assert((spellTrap.type & CardType.SPELL) !== 0, '魔陷占位卡应是魔法卡')

  console.log('[placeholder-data] ALL PASSED')
}

main()
