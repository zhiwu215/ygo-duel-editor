export interface OcgCardData {
  code: number
  alias: number
  setcodes: number[]
  type: number
  level: number
  attribute: number
  race: bigint
  attack: number
  defense: number
  lscale: number
  rscale: number
  link_marker: number
}

export const OcgLocation = {
  DECK: 0x01,
  HAND: 0x02,
  MZONE: 0x04,
  SZONE: 0x08,
  GRAVE: 0x10,
  REMOVED: 0x20,
  EXTRA: 0x40,
  OVERLAY: 0x80,
  FZONE: 0x100,
  PZONE: 0x200
} as const
export type OcgLocation = (typeof OcgLocation)[keyof typeof OcgLocation]

export const OcgPosition = {
  FACEUP_ATTACK: 0x1,
  FACEDOWN_ATTACK: 0x2,
  FACEUP_DEFENSE: 0x4,
  FACEDOWN_DEFENSE: 0x8,
  FACEUP: 0x5,
  FACEDOWN: 0xa
} as const
export type OcgPosition = (typeof OcgPosition)[keyof typeof OcgPosition]

export const OcgMessageType = {
  RETRY: 1,
  HINT: 2,
  WAITING: 3,
  START: 4,
  WIN: 5,
  UPDATE_DATA: 6,
  UPDATE_CARD: 7,
  REQUEST_DECK: 8,
  SELECT_BATTLECMD: 10,
  SELECT_IDLECMD: 11,
  SELECT_EFFECTYN: 12,
  SELECT_YESNO: 13,
  SELECT_OPTION: 14,
  SELECT_CARD: 15,
  SELECT_CHAIN: 16,
  SELECT_PLACE: 18,
  SELECT_POSITION: 19,
  SELECT_TRIBUTE: 20,
  SORT_CHAIN: 21,
  SELECT_COUNTER: 22,
  SELECT_SUM: 23,
  SELECT_DISFIELD: 24,
  SORT_CARD: 25,
  SELECT_UNSELECT_CARD: 26,
  CONFIRM_DECKTOP: 30,
  CONFIRM_CARDS: 31,
  SHUFFLE_DECK: 32,
  SHUFFLE_HAND: 33,
  REFRESH_DECK: 34,
  SWAP_GRAVE_DECK: 35,
  SHUFFLE_SET_CARD: 36,
  REVERSE_DECK: 37,
  DECK_TOP: 38,
  SHUFFLE_EXTRA: 39,
  NEW_TURN: 40,
  NEW_PHASE: 41,
  CONFIRM_EXTRATOP: 42,
  MOVE: 50,
  POS_CHANGE: 53,
  SET: 54,
  SWAP: 55,
  FIELD_DISABLED: 56,
  SUMMONING: 60,
  SUMMONED: 61,
  SPSUMMONING: 62,
  SPSUMMONED: 63,
  FLIPSUMMONING: 64,
  FLIPSUMMONED: 65,
  CHAINING: 70,
  CHAINED: 71,
  CHAIN_SOLVING: 72,
  CHAIN_SOLVED: 73,
  CHAIN_END: 74,
  CHAIN_NEGATED: 75,
  CHAIN_DISABLED: 76,
  CARD_SELECTED: 80,
  RANDOM_SELECTED: 81,
  BECOME_TARGET: 83,
  DRAW: 90,
  DAMAGE: 91,
  RECOVER: 92,
  EQUIP: 93,
  LPUPDATE: 94,
  CARD_TARGET: 96,
  CANCEL_TARGET: 97,
  PAY_LPCOST: 100,
  ADD_COUNTER: 101,
  REMOVE_COUNTER: 102,
  ATTACK: 110,
  BATTLE: 111,
  ATTACK_DISABLED: 112,
  DAMAGE_STEP_START: 113,
  DAMAGE_STEP_END: 114,
  MISSED_EFFECT: 120,
  BE_CHAIN_TARGET: 121,
  CREATE_RELATION: 122,
  RELEASE_RELATION: 123,
  TOSS_COIN: 130,
  TOSS_DICE: 131,
  ROCK_PAPER_SCISSORS: 132,
  HAND_RES: 133,
  ANNOUNCE_RACE: 140,
  ANNOUNCE_ATTRIB: 141,
  ANNOUNCE_CARD: 142,
  ANNOUNCE_NUMBER: 143,
  CARD_HINT: 160,
  TAG_SWAP: 161,
  RELOAD_FIELD: 162,
  AI_NAME: 163,
  SHOW_HINT: 164,
  PLAYER_HINT: 165,
  MATCH_KILL: 170,
  CUSTOM_MSG: 180,
  REMOVE_CARDS: 190
} as const
export type OcgMessageType = (typeof OcgMessageType)[keyof typeof OcgMessageType]

export const OcgResponseType = {
  SELECT_BATTLECMD: 0,
  SELECT_IDLECMD: 1,
  SELECT_EFFECTYN: 2,
  SELECT_YESNO: 3,
  SELECT_OPTION: 4,
  SELECT_CARD: 5,
  SELECT_CARD_CODES: 6,
  SELECT_UNSELECT_CARD: 7,
  SELECT_CHAIN: 8,
  SELECT_DISFIELD: 9,
  SELECT_PLACE: 10,
  SELECT_POSITION: 11,
  SELECT_TRIBUTE: 12,
  SELECT_COUNTER: 13,
  SELECT_SUM: 14,
  SORT_CARD: 15,
  ANNOUNCE_RACE: 16,
  ANNOUNCE_ATTRIB: 17,
  ANNOUNCE_CARD: 18,
  ANNOUNCE_NUMBER: 19,
  ROCK_PAPER_SCISSORS: 20
} as const
export type OcgResponseType = (typeof OcgResponseType)[keyof typeof OcgResponseType]

export interface OcgResponse {
  type: number
  action?: number
  index?: number | null
  yes?: boolean
  indicies?: number[] | null
  codes?: number[] | null
  places?: Array<{ player: number; location: number; sequence: number }> | null
  position?: number
  counters?: number[] | null
  order?: number[] | null
  races?: bigint[] | null
  attributes?: number[] | null
  card?: number
  value?: number
}

export const OcgProcessResult = {
  END: 0,
  WAITING: 1,
  CONTINUE: 2
} as const
export type OcgProcessResult = (typeof OcgProcessResult)[keyof typeof OcgProcessResult]

export const SelectIdleCMDAction = {
  SELECT_SUMMON: 0,
  SELECT_SPECIAL_SUMMON: 1,
  SELECT_POS_CHANGE: 2,
  SELECT_MONSTER_SET: 3,
  SELECT_SPELL_SET: 4,
  SELECT_ACTIVATE: 5,
  TO_BP: 6,
  TO_EP: 7,
  SHUFFLE: 8
} as const
export type SelectIdleCMDAction = (typeof SelectIdleCMDAction)[keyof typeof SelectIdleCMDAction]

export const SelectBattleCMDAction = {
  SELECT_CHAIN: 0,
  SELECT_BATTLE: 1,
  TO_M2: 2,
  TO_EP: 3
} as const
export type SelectBattleCMDAction =
  (typeof SelectBattleCMDAction)[keyof typeof SelectBattleCMDAction]

export const OcgDuelMode = {
  TEST_MODE: 0x01n,
  ATTACK_FIRST_TURN: 0x02n,
  USE_TRAPS_IN_NEW_CHAIN: 0x04n,
  SIX_STEP_BATLLE_STEP: 0x08n,
  PSEUDO_SHUFFLE: 0x10n,
  TRIGGER_WHEN_PRIVATE_KNOWLEDGE: 0x20n,
  SIMPLE_AI: 0x40n,
  RELAY: 0x80n,
  OBSOLETE_IGNITION: 0x100n,
  FIRST_TURN_DRAW: 0x200n,
  ONE_FACEUP_FIELD: 0x400n,
  PZONE: 0x800n,
  SEPARATE_PZONE: 0x1000n,
  EMZONE: 0x2000n,
  FSX_MMZONE: 0x4000n,
  TRAP_MONSTERS_NOT_USE_ZONE: 0x8000n,
  RETURN_TO_DECK_TRIGGERS: 0x10000n,
  TRIGGER_ONLY_IN_LOCATION: 0x20000n,
  SPSUMMON_ONCE_OLD_NEGATE: 0x40000n,
  CANNOT_SUMMON_OATH_OLD: 0x80000n,
  NO_STANDBY_PHASE: 0x100000n,
  NO_MAIN_PHASE_2: 0x200000n,
  THREE_COLUMNS_FIELD: 0x400000n,
  DRAW_UNTIL_5: 0x800000n,
  NO_HAND_LIMIT: 0x1000000n,
  UNLIMITED_SUMMONS: 0x2000000n,
  INVERTED_QUICK_PRIORITY: 0x4000000n,
  EQUIP_NOT_SENT_IF_MISSING_TARGET: 0x8000000n,
  ZERO_ATK_DESTROYED: 0x10000000n,
  STORE_ATTACK_REPLAYS: 0x20000000n,
  SINGLE_CHAIN_IN_DAMAGE_SUBSTEP: 0x40000000n,
  CAN_REPOS_IF_NON_SUMPLAYER: 0x80000000n,
  TCG_SEGOC_NONPUBLIC: 0x100000000n,
  TCG_SEGOC_FIRSTTRIGGER: 0x200000000n,
  MODE_MR1: 0x80201n,
  MODE_MR2: 0x80201n,
  MODE_MR3: 0x81a00n,
  MODE_MR4: 0x82800n,
  MODE_MR5: 0x2e800n
} as const

export const OcgQueryFlags = {
  CODE: 1,
  POSITION: 2,
  ALIAS: 4,
  TYPE: 8,
  LEVEL: 16,
  RANK: 32,
  ATTRIBUTE: 64,
  RACE: 128,
  ATTACK: 256,
  DEFENSE: 512,
  BASE_ATTACK: 1024,
  BASE_DEFENSE: 2048,
  REASON: 4096,
  REASON_CARD: 8192,
  EQUIP_CARD: 16384,
  TARGET_CARD: 32768,
  OVERLAY_CARD: 65536,
  COUNTERS: 131072,
  OWNER: 262144,
  STATUS: 524288,
  IS_PUBLIC: 1048576,
  LSCALE: 2097152,
  RSCALE: 4194304,
  LINK: 8388608,
  IS_HIDDEN: 16777216,
  COVER: 33554432
} as const
export type OcgQueryFlags = (typeof OcgQueryFlags)[keyof typeof OcgQueryFlags] | number

export type OcgDuelHandle = bigint | number

export interface OcgQuery {
  flags: number
  controller: number
  location: number
  sequence: number
  overlaySequence?: number
}

export interface OcgCardQueryInfoCard {
  controller: number
  location: number
  sequence: number
  position: number
}

export interface OcgCardQueryInfo {
  code?: number
  position?: number
  alias?: number
  type?: number
  level?: number
  rank?: number
  attribute?: number
  race?: bigint
  attack?: number
  defense?: number
  baseAttack?: number
  baseDefense?: number
  reason?: number
  cover?: number
  reasonCard?: OcgCardQueryInfoCard | null
  equipCard?: OcgCardQueryInfoCard | null
  targetCards?: OcgCardQueryInfoCard[]
  overlayCards?: number[]
  counters?: Record<number, number>
  owner?: number
  status?: number
  isPublic?: boolean
  leftScale?: number
  rightScale?: number
  isHidden?: boolean
  link?: {
    rating: number
    marker: number
  }
}
