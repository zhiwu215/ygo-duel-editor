const engineToEditorId = new Map<string, string>()

export function getEditorId(engineId: string): string | undefined {
  return engineToEditorId.get(engineId)
}

export function registerIdentity(engineId: string, editorId: string): void {
  engineToEditorId.set(engineId, editorId)
}

export function toEditorToEngineMap(): Map<string, string> {
  const editorToEngineId = new Map<string, string>()
  for (const [engineId, editorId] of engineToEditorId) {
    editorToEngineId.set(editorId, engineId)
  }
  return editorToEngineId
}

export function clearIdentities(): void {
  engineToEditorId.clear()
}

export function resolveEditorId(id: string): string {
  return engineToEditorId.get(id) ?? id
}

export function isSameCardInstance(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return a === b || resolveEditorId(a) === resolveEditorId(b)
}
