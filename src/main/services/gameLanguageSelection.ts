import { GameLanguagePack, resolveGameLanguagePack } from './gameContent'
import { FOLLOW_GAME_LANGUAGE } from './gameLanguagePreference'

export interface GameLanguageSelection {
  explicit: string | undefined

  pack: GameLanguagePack | null

  prompt: boolean
}

export function selectGameLanguage(
  packs: GameLanguagePack[],
  remembered: string | undefined,
  systemLanguage: string | null
): GameLanguageSelection {
  const known = (id: string | undefined): boolean =>
    id != null && packs.some((pack) => pack.id === id)
  const explicit =
    remembered && remembered !== FOLLOW_GAME_LANGUAGE && known(remembered) ? remembered : undefined
  const pack =
    packs.find((item) => item.id === explicit) ?? resolveGameLanguagePack(packs, systemLanguage)
  const settled = remembered === FOLLOW_GAME_LANGUAGE || known(remembered)
  return { explicit, pack, prompt: packs.length > 1 && !settled }
}
