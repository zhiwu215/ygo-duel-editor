import { useState } from 'react'

export function useCopyFeedback(source: string): {
  copiedField: string | null
  copy: (field: string, text: string) => Promise<void>
} {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copy = async (field: string, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch (err) {
      console.error(`[${source}] Failed to copy:`, err)
    }
  }

  return { copiedField, copy }
}
