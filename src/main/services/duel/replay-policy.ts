import type { Answer, AnswerPrompt, EngineRequest, RecordedAnswer } from '@shared/engine/protocol'
import { encodeAnswer } from './answer-encoder'
import { alignAnswerToRequest, type AnswerCodeRemap } from './answer-align'

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
  recorded: RecordedAnswer,
  codeRemap?: AnswerCodeRemap
): Uint8Array {
  let answer = recorded.answer
  if (answer.kind === 'option') {
    const choices = request.data.kind === 'option' ? request.data.options : []
    const chosen = recorded.option
    const index = chosen
      ? choices.findIndex(
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
  if (codeRemap) {
    const aligned = alignAnswerToRequest(request, answer, codeRemap)
    if (aligned) {
      answer = aligned
      recorded.answer = aligned
    }
  }
  try {
    return encodeAnswer(msg, answer)
  } catch (err) {
    throw new ReplayDivergenceError(
      err instanceof Error ? err.message : '历史应答无法编码到当前询问。'
    )
  }
}
