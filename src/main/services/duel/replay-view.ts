import { YGOProMessages, type YGOProMsgBase } from 'ygopro-msg-encode'
import type { ReplayExportView } from '@shared/index'

const OBSERVER_VIEWER = 7

export function replayViewerOf(view: ReplayExportView): number {
  return view === 'observer' ? OBSERVER_VIEWER : 0
}

export function applyReplayView(payload: Uint8Array, viewer: number): Uint8Array | null {
  let message: YGOProMsgBase | undefined
  try {
    message = YGOProMessages.getInstanceFromPayload(payload)
  } catch {
    return payload
  }
  if (!message) return payload

  let targets: number[] = []
  try {
    targets = message.getSendTargets()
  } catch {
    targets = []
  }
  if (targets.length > 0 && !targets.includes(viewer)) return null

  try {
    return message.playerView(viewer).toPayload()
  } catch {
    return payload
  }
}

export function applyReplayViewToPayloads(
  payloads: Uint8Array[],
  view: ReplayExportView
): Uint8Array[] {
  const viewer = replayViewerOf(view)
  const out: Uint8Array[] = []
  for (const payload of payloads) {
    const viewed = applyReplayView(payload, viewer)
    if (viewed) out.push(viewed)
  }
  return out
}
