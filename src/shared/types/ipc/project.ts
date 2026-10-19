import { DuelSourceRef, DuelType } from '../duel'

export interface DuelProjectMeta {
  id: string
  filePath: string
  title: string
  duelType: DuelType
  series?: string
  sourceRef?: DuelSourceRef
  hint?: string
  masterRule: number
  cardCount: number
  stepCount?: number
  updatedAt: number
}
