let engineActive = false

export function setEngineActive(value: boolean): void {
  engineActive = value
}

export function isEngineActive(): boolean {
  return engineActive
}
