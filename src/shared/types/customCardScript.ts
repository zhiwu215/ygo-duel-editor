export type CustomScriptTestLocation =
  'deck' | 'hand' | 'mzone' | 'szone' | 'grave' | 'removed' | 'extra'

export type CustomScriptTestPosition =
  'faceup_attack' | 'facedown_attack' | 'faceup_defense' | 'facedown_defense'

export interface CustomScriptTestSetupCard {
  code: number
  controller: 0 | 1
  owner: 0 | 1
  location: CustomScriptTestLocation
  sequence?: number
  position: CustomScriptTestPosition
}

export type CustomScriptTestResponse =
  | {
      kind: 'select-card'
      cards: Array<{
        index?: number
        code?: number
        controller?: 0 | 1
        location?: CustomScriptTestLocation
        sequence?: number
      }>
    }
  | { kind: 'yes-no'; value: boolean }
  | { kind: 'chain'; index?: number; code?: number }
  | { kind: 'option'; index: number }
  | { kind: 'position'; position: CustomScriptTestPosition }

export type CustomScriptTestCheck =
  | { kind: 'load-script'; code?: number }
  | { kind: 'start-duel' }
  | { kind: 'advance'; maxSteps: number }
  | { kind: 'assert-no-redtext' }
  | { kind: 'assert-lp'; player: 0 | 1; equals: number }
  | {
      kind: 'assert-field-count'
      player: 0 | 1
      location: CustomScriptTestLocation
      equals?: number
      min?: number
      max?: number
    }

export interface CustomScriptTestPlan {
  version: 1
  cardCode: number
  seed?: number | number[]
  includeScripts: string[]
  setup: CustomScriptTestSetupCard[]
  responses?: CustomScriptTestResponse[]
  checks: CustomScriptTestCheck[]
}

export interface CustomScriptTestReport {
  ok: boolean
  summary: string
  loadedScripts: string[]
  logs: string[]
  errors: string[]
  steps: number
}

export interface CustomCardScriptDraft {
  code: number
  name: string
  desc: string
  type: number
  attribute: number
  race: number
  level: number
  lscale: number
  rscale: number
  atk: number
  def: number
  linkMarkers: number
  alias: number
  ot: number
  setcode: number[]
  category: number
  strings: string[]
}

export interface CustomCardScriptGenerateResult {
  success: boolean
  script?: string
  strings?: string[]
  category?: number
  testPlan?: CustomScriptTestPlan
  report?: CustomScriptTestReport
  error?: string
  notes?: string
}
