let depth = 0

export function pauseAutoRecording(): void {
  depth += 1
}

export function resumeAutoRecording(): void {
  depth = Math.max(0, depth - 1)
}

export function isAutoRecordingPaused(): boolean {
  return depth > 0
}
