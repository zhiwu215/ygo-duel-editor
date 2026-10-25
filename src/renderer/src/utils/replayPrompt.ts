const REPLAY_PROMPT_PATTERN =
  /是否(?:连锁|发动)|是否.*?发动|主要阶段行动|优先权|等待对方|请选择\/取消选择/

export function isReplayPromptText(text: string | undefined): boolean {
  return text !== undefined && REPLAY_PROMPT_PATTERN.test(text)
}
