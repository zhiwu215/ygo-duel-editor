export type CardNoteKind = 'chant' | 'note'

export interface CardNote {
  cardCode: number
  kind: CardNoteKind
  title: string
  text: string
  user?: string
  source?: string
  readonly?: boolean
}

export interface DefaultCardNote {
  cardCode: number
  cardName: string
  kind: CardNoteKind
  title: string
  text: string
  user?: string
  source?: string
}

export interface CardNoteLibrary {
  notes: Record<string, CardNote[]>
}

export interface CardNoteEntry {
  cardCode: number
  cardName: string
  variantCodes: number[]
  chants: CardNote[]
  notes: CardNote[]
}
