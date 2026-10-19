export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function toErrorMessageOr(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
