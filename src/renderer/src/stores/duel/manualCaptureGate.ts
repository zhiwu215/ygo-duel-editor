let depth = 0

export function pauseManualCapture(): void {
  depth += 1
}

export function resumeManualCapture(): void {
  depth = Math.max(0, depth - 1)
}

export function isManualCapturePaused(): boolean {
  return depth > 0
}
