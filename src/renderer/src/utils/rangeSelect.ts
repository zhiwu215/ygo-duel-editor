export function toggleRangeSelect(
  picked: Set<string>,
  id: string,
  anchor: string | null,
  shiftKey: boolean,
  orderedIds: string[]
): Set<string> {
  const next = new Set(picked)
  if (shiftKey && anchor) {
    const a = orderedIds.indexOf(anchor)
    const b = orderedIds.indexOf(id)
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a]
      const allOn = orderedIds.slice(lo, hi + 1).every((x) => next.has(x))
      for (let i = lo; i <= hi; i++) {
        if (allOn) next.delete(orderedIds[i])
        else next.add(orderedIds[i])
      }
      return next
    }
  }
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
