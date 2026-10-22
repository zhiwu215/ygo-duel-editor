import { useState } from 'react'
import type { CustomCard, CustomCardScriptGenerateResult } from '@shared/index'

interface GenerateOptions {
  card: CustomCard
  onEnsureId: (id: number) => void
}

export function useCustomCardScriptGeneration(): {
  busy: boolean
  error: string
  result: CustomCardScriptGenerateResult | null
  applied: boolean
  generate: (options: GenerateOptions) => Promise<void>
  apply: (card: CustomCard) => Promise<CustomCardScriptGenerateResult | null>
  reset: () => void
} {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CustomCardScriptGenerateResult | null>(null)
  const [applied, setApplied] = useState(false)

  const generate = async ({ card, onEnsureId }: GenerateOptions): Promise<void> => {
    setBusy(true)
    setError('')
    setApplied(false)
    try {
      let id = card.id
      if (!id) {
        id = await window.api.allocateCustomCardId()
        onEnsureId(id)
      }
      const existing =
        id > 0 ? ((await window.api.readCustomCardScriptContent(id)) ?? undefined) : undefined
      const next = await window.api.generateCustomCardScript({
        card: { ...card, id },
        existingScript: existing
      })
      setResult(next)
      if (!next.success) setError(next.error ?? '脚本生成失败')
    } catch (err) {
      setError(err instanceof Error ? err.message : '脚本生成失败')
    } finally {
      setBusy(false)
    }
  }

  const apply = async (card: CustomCard): Promise<CustomCardScriptGenerateResult | null> => {
    if (!result?.script) return null
    if (!card.id) {
      setError('缺少卡密，无法写入脚本。')
      return null
    }
    setBusy(true)
    setError('')
    try {
      const saved = await window.api.saveCustomCardScriptContent(card.id, result.script)
      if (!saved.success) {
        setError(saved.error ?? '脚本保存失败')
        return null
      }
      setApplied(true)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : '脚本保存失败')
      return null
    } finally {
      setBusy(false)
    }
  }

  const reset = (): void => {
    setBusy(false)
    setError('')
    setResult(null)
    setApplied(false)
  }

  return { busy, error, result, applied, generate, apply, reset }
}
