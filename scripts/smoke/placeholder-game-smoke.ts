import {
  CardLocation,
  CardType,
  DuelPuzzleState,
  FieldCard,
  PLACEHOLDER_CARD_CODE,
  PLACEHOLDER_MONSTER_CARD_CODE,
  PLACEHOLDER_SPELL_TRAP_CARD_CODE,
  CardPosition
} from '@shared/index'
import {
  mapPlaceholderCodesForGame,
  placeholderGameCards,
  placeholderSpellScript
} from '../../src/main/services/placeholderGameCards'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function makeCard(instanceId: string, code: number, location: number, sequence: number): FieldCard {
  return {
    instanceId,
    code,
    controller: 0,
    owner: 0,
    location,
    sequence,
    position: CardPosition.FACEUP,
    overlayMaterials: []
  }
}

function makeState(cards: FieldCard[]): DuelPuzzleState {
  return {
    version: '1.2.0',
    title: '占位卡游戏数据联测',
    hint: '',
    duelType: 'full',
    masterRule: 5,
    players: [
      { lp: 8000, maxHand: 0, startHand: 0 },
      { lp: 8000, maxHand: 0, startHand: 0 }
    ],
    turnPlayer: 0,
    firstTurnAttack: true,
    cards,
    scenarios: {
      scene: {
        duelists: [],
        cards: [makeCard('scenario-card', PLACEHOLDER_CARD_CODE, CardLocation.SZONE, 0)],
        turnPlayer: 0,
        firstTurnAttack: true,
        matchConfig: { mode: '1v1', team0Count: 1, team1Count: 1, sharedLp: false }
      }
    }
  }
}

function main(): void {
  const cards = placeholderGameCards()
  assert(cards.length === 3, '应生成三张占位卡游戏数据')
  const neutral = cards.find((card) => card.id === PLACEHOLDER_CARD_CODE)
  const monster = cards.find((card) => card.id === PLACEHOLDER_MONSTER_CARD_CODE)
  const spellTrap = cards.find((card) => card.id === PLACEHOLDER_SPELL_TRAP_CARD_CODE)
  assert(Boolean(neutral), '未定占位卡数据存在')
  assert(Boolean(monster), '怪兽占位卡数据存在')
  assert(Boolean(spellTrap), '魔陷占位卡数据存在')
  assert(
    neutral!.type === (CardType.MONSTER | CardType.NORMAL) && neutral!.level === 1,
    '未定占位卡应是 1 星通常怪兽'
  )
  assert(
    monster!.type === (CardType.MONSTER | CardType.NORMAL) && monster!.level === 1,
    '怪兽占位卡应是 1 星通常怪兽'
  )
  assert(monster!.desc === '怪兽占位卡', '怪兽占位卡文本')
  assert(spellTrap!.type === CardType.SPELL && spellTrap!.level === 0, '魔陷占位卡应是通常魔法')
  assert(neutral!.atk === 0 && neutral!.def === 0, '占位怪兽 0 攻 0 防')
  assert(placeholderSpellScript().includes('initial_effect'), '魔陷占位卡脚本存在')

  const state = makeState([
    makeCard('hand', PLACEHOLDER_CARD_CODE, CardLocation.HAND, 0),
    makeCard('mzone', PLACEHOLDER_CARD_CODE, CardLocation.MZONE, 0),
    makeCard('szone', PLACEHOLDER_CARD_CODE, CardLocation.SZONE, 0),
    makeCard('deck', PLACEHOLDER_CARD_CODE, CardLocation.DECK, 0),
    makeCard('typed-monster', PLACEHOLDER_MONSTER_CARD_CODE, CardLocation.MZONE, 1),
    makeCard('typed-spell', PLACEHOLDER_SPELL_TRAP_CARD_CODE, CardLocation.SZONE, 1)
  ])
  const mapped = mapPlaceholderCodesForGame(state)
  assert(mapped.cards[0].code === PLACEHOLDER_CARD_CODE, '手牌未定占位保持未定')
  assert(mapped.cards[1].code === PLACEHOLDER_MONSTER_CARD_CODE, '怪兽区未定占位映射为怪兽')
  assert(mapped.cards[2].code === PLACEHOLDER_SPELL_TRAP_CARD_CODE, '魔陷区未定占位映射为魔陷')
  assert(mapped.cards[3].code === PLACEHOLDER_CARD_CODE, '卡组未定占位保持未定')
  assert(mapped.cards[4].code === PLACEHOLDER_MONSTER_CARD_CODE, '已选怪兽占位保持不变')
  assert(mapped.cards[5].code === PLACEHOLDER_SPELL_TRAP_CARD_CODE, '已选魔陷占位保持不变')
  assert(
    mapped.scenarios?.scene.cards[0].code === PLACEHOLDER_SPELL_TRAP_CARD_CODE,
    '场景中的魔陷区占位也应映射'
  )
  console.log('[placeholder-game-smoke] ALL CHECKS PASSED')
}

main()
