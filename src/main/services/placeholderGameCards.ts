import {
  CardAttribute,
  CardLocation,
  CardRace,
  CardType,
  CustomCard,
  DuelPuzzleState,
  FieldCard,
  PLACEHOLDER_CARD_CODE,
  PLACEHOLDER_MONSTER_CARD_CODE,
  PLACEHOLDER_MONSTER_DESC,
  PLACEHOLDER_NEUTRAL_DESC,
  PLACEHOLDER_SPELL_TRAP_CARD_CODE,
  PLACEHOLDER_SPELL_TRAP_DESC
} from '@shared/index'

const NEUTRAL_NAME = '占位卡'
const MONSTER_NAME = '占位卡（怪兽）'
const SPELL_TRAP_NAME = '占位卡（魔陷）'

function makePlaceholderCard(
  id: number,
  name: string,
  desc: string,
  type: number,
  level: number,
  attribute: number,
  race: number
): CustomCard {
  return {
    schemaVersion: 2,
    id,
    alias: 0,
    ot: 0,
    setcode: [0, 0, 0, 0],
    type,
    attribute,
    race,
    level,
    lscale: 0,
    rscale: 0,
    atk: 0,
    def: 0,
    linkMarkers: 0,
    category: 0,
    name,
    desc,
    strings: [],
    createdAt: 0,
    updatedAt: 0
  }
}

export function placeholderGameCards(): CustomCard[] {
  return [
    makePlaceholderCard(
      PLACEHOLDER_CARD_CODE,
      NEUTRAL_NAME,
      PLACEHOLDER_NEUTRAL_DESC,
      CardType.MONSTER | CardType.NORMAL,
      1,
      CardAttribute.EARTH,
      CardRace.WARRIOR
    ),
    makePlaceholderCard(
      PLACEHOLDER_MONSTER_CARD_CODE,
      MONSTER_NAME,
      PLACEHOLDER_MONSTER_DESC,
      CardType.MONSTER | CardType.NORMAL,
      1,
      CardAttribute.EARTH,
      CardRace.WARRIOR
    ),
    makePlaceholderCard(
      PLACEHOLDER_SPELL_TRAP_CARD_CODE,
      SPELL_TRAP_NAME,
      PLACEHOLDER_SPELL_TRAP_DESC,
      CardType.SPELL,
      0,
      0,
      0
    )
  ]
}

export function placeholderSpellScript(): string {
  return 'local s,id=GetID()\nfunction s.initial_effect(c)\nend\n'
}

function mapPlaceholderCardForGame(card: FieldCard): FieldCard {
  if (card.code !== PLACEHOLDER_CARD_CODE) return card
  let code = PLACEHOLDER_CARD_CODE
  if (card.location === CardLocation.SZONE || card.location === CardLocation.FZONE) {
    code = PLACEHOLDER_SPELL_TRAP_CARD_CODE
  } else if (card.location === CardLocation.MZONE) {
    code = PLACEHOLDER_MONSTER_CARD_CODE
  }
  return code === card.code ? card : { ...card, code }
}

export function mapPlaceholderCodesForGame(state: DuelPuzzleState): DuelPuzzleState {
  const cards = state.cards.map(mapPlaceholderCardForGame)
  const scenarios = state.scenarios
    ? Object.fromEntries(
        Object.entries(state.scenarios).map(([key, scene]) => [
          key,
          { ...scene, cards: scene.cards.map(mapPlaceholderCardForGame) }
        ])
      )
    : state.scenarios
  return { ...state, cards, scenarios }
}
