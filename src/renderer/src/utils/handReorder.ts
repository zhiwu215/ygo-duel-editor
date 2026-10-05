export interface HandInsertionPosition {
  targetInstanceId: string | null
  side: 'before' | 'after'
}

interface HandCardAnchor {
  instanceId: string
  centerX: number
}

/**
 * Capture card centers in the scroll container's content coordinate space.
 * Keeping these anchors fixed during a drag prevents the insertion gap from
 * moving the hit areas underneath the pointer and making the target jitter.
 */
export function captureHandCardAnchors(container: HTMLElement): HandCardAnchor[] {
  const containerRect = container.getBoundingClientRect()
  const contentLeft = containerRect.left + container.clientLeft

  return Array.from(container.querySelectorAll<HTMLElement>('[data-hand-instance-id]'))
    .map((element) => {
      const instanceId = element.dataset.handInstanceId
      if (!instanceId) return null
      const rect = element.getBoundingClientRect()
      return {
        instanceId,
        centerX: rect.left - contentLeft + container.scrollLeft + rect.width / 2
      }
    })
    .filter((anchor): anchor is HandCardAnchor => anchor !== null)
}

/** Resolve a stable before/after insertion target from the pointer's content position. */
export function getHandInsertionPosition(
  container: HTMLElement,
  anchors: HandCardAnchor[],
  movingInstanceId: string | null,
  clientX: number
): HandInsertionPosition | null {
  const candidates = anchors.filter((anchor) => anchor.instanceId !== movingInstanceId)
  if (candidates.length === 0) return null

  const containerRect = container.getBoundingClientRect()
  const pointerX = clientX - containerRect.left - container.clientLeft + container.scrollLeft
  const nextAnchor = candidates.find((anchor) => pointerX < anchor.centerX)

  if (nextAnchor) {
    return { targetInstanceId: nextAnchor.instanceId, side: 'before' }
  }

  return { targetInstanceId: candidates[candidates.length - 1].instanceId, side: 'after' }
}
