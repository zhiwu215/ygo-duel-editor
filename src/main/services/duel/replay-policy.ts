import type {
  Answer,
  AnswerPrompt,
  EngineRequest,
  RecordedAnswer,
  RequestCard
} from '@shared/engine/protocol'
import { encodeAnswer } from './answer-encoder'

export class ReplayDivergenceError extends Error {
  opIndex = -1
  responseIndex = -1
  forkStepId: string | null = null
  expectedTitle = ''
  actualTitle = ''

  constructor(message: string) {
    super(message)
    this.name = 'ReplayDivergenceError'
  }
}

export function createRecordedAnswer(request: EngineRequest, answer: Answer): RecordedAnswer {
  const recorded: RecordedAnswer = {
    prompt: promptOf(request),
    answer: structuredClone(answer)
  }
  if (answer.kind === 'option' && request.data.kind === 'option') {
    const option = request.data.options[answer.index]
    if (option) recorded.option = { code: option.code, text: option.text }
  }
  return recorded
}

function promptOf(request: EngineRequest): AnswerPrompt {
  return {
    identifier: request.identifier,
    player: request.player,
    kind: request.kind,
    title: request.title
  }
}

export function samePrompt(request: EngineRequest, prompt: AnswerPrompt): boolean {
  return (
    request.identifier === prompt.identifier &&
    request.player === prompt.player &&
    request.kind === prompt.kind
  )
}

export function isNewOptionalPrompt(request: EngineRequest): boolean {
  if (request.kind === 'chain') {
    return request.data.kind === 'chain' && !request.data.forced
  }
  return request.kind === 'yesno'
}

export function defaultOptionalAnswer(request: EngineRequest): Answer | null {
  if (request.kind === 'chain') {
    return { kind: 'chain', card: null }
  }
  if (request.kind === 'yesno') {
    return { kind: 'yesno', yes: false }
  }
  return null
}

export function encodeRecordedAnswer(
  msg: unknown,
  request: EngineRequest,
  recorded: RecordedAnswer
): Uint8Array {
  let answer = recorded.answer
  if (answer.kind === 'option') {
    const options = request.data.kind === 'option' ? request.data.options : []
    const chosen = recorded.option
    const index = chosen
      ? options.findIndex(
          (option) =>
            option.code === chosen.code &&
            (chosen.text === undefined || option.text === chosen.text)
        )
      : -1
    if (index < 0) {
      throw new ReplayDivergenceError('历史选项已不在当前询问中。')
    }
    answer = { ...answer, index }
  }
  try {
    return encodeAnswer(msg, answer)
  } catch (err) {
    try {
      return encodeAnswer(msg, relaxAnswer(answer))
    } catch {
      throw new ReplayDivergenceError(
        err instanceof Error ? err.message : '历史应答无法编码到当前询问。'
      )
    }
  }
}

function relaxCard(card: RequestCard): RequestCard {
  const relaxed = { ...card } as Partial<RequestCard>
  delete relaxed.sequence
  delete relaxed.desc
  return relaxed as RequestCard
}

function relaxAnswer(answer: Answer): Answer {
  switch (answer.kind) {
    case 'idle':
    case 'battle':
    case 'chain':
    case 'unselect':
      return answer.card ? { ...answer, card: relaxCard(answer.card) } : answer
    case 'card':
    case 'tribute':
    case 'sum':
    case 'sort':
      return answer.cards ? { ...answer, cards: answer.cards.map(relaxCard) } : answer
    case 'counter':
      return {
        ...answer,
        counters: answer.counters.map((entry) => ({
          ...entry,
          card: relaxCard(entry.card)
        }))
      }
    default:
      return answer
  }
}
