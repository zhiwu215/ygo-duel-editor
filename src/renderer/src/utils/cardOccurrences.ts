export function getCodeOccurrences(codes: number[]): number[] {
  const occurrences = new Map<number, number>()
  return codes.map((code) => {
    const occurrence = occurrences.get(code) ?? 0
    occurrences.set(code, occurrence + 1)
    return occurrence
  })
}
