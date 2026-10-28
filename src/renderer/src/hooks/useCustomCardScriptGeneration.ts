import { useEffect, useRef, useState } from 'react'
import type {
  CustomCard,
  CustomCardScriptGenerateEvent,
  CustomCardScriptGenerateResult
} from '@shared/index'
import {
  applyAiScriptTraceEvent,
  createAiScriptTrace,
  type AiScriptTraceState
} from '../utils/aiScriptTrace'

interface GenerateOptions {
  card: CustomCard
  onEnsureId: (id: number) => void
}

export function useCustomCardScriptGeneration(): {
  generating: boolean
  saving: boolean
  cancelled: boolean
  error: string
  result: CustomCardScriptGenerateResult | null
  applied: boolean
  trace: AiScriptTraceState | null
  generate: (options: GenerateOptions) => Promise<void>
  apply: (ensureCard: () => Promise<number>) => Promise<CustomCardScriptGenerateResult | null>
  abort: () => Promise<void>
  reset: () => void
} {
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CustomCardScriptGenerateResult | null>(null)
  const [applied, setApplied] = useState(false)
  const [trace, setTrace] = useState<AiScriptTraceState | null>(null)
  const generatingRef = useRef(false)
  const abortRequestedRef = useRef(false)

  const applyTraceEvent = (event: CustomCardScriptGenerateEvent): void => {
    setTrace((current) => (current ? applyAiScriptTraceEvent(current, event) : current))
  }

  useEffect(() => {
    return () => {
      if (generatingRef.current) void window.api.abortCustomCardScriptGeneration()
    }
  }, [])

  const generate = async ({ card, onEnsureId }: GenerateOptions): Promise<void> => {
    if (generatingRef.current) return
    generatingRef.current = true
    abortRequestedRef.current = false
    setGenerating(true)
    setCancelled(false)
    setError('')
    setApplied(false)
    setTrace(createAiScriptTrace(Date.now()))

    const unsubscribe = window.api.onCustomCardScriptGenerateEvent(applyTraceEvent)

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
      if (next.success) {
        setCancelled(false)
      } else if (!abortRequestedRef.current) {
        setError(next.error ?? '脚本生成失败')
      }
    } catch (err) {
      if (!abortRequestedRef.current) {
        setError(err instanceof Error ? err.message : '脚本生成失败')
      }
    } finally {
      unsubscribe()
      generatingRef.current = false
      setGenerating(false)
    }
  }

  const apply = async (
    ensureCard: () => Promise<number>
  ): Promise<CustomCardScriptGenerateResult | null> => {
    if (!result?.script) return null
    setSaving(true)
    setError('')
    try {
      const id = await ensureCard()
      const saved = await window.api.saveCustomCardScriptContent(id, result.script)
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
      setSaving(false)
    }
  }

  const abort = async (): Promise<void> => {
    if (!generatingRef.current) return
    applyTraceEvent({ type: 'status', message: '正在中止…' })
    try {
      const aborted = await window.api.abortCustomCardScriptGeneration()
      if (!aborted) return
      abortRequestedRef.current = true
      setCancelled(true)
    } catch {
      applyTraceEvent({ type: 'status', message: '中止失败，生成仍在进行…' })
    }
  }

  const reset = (): void => {
    setGenerating(false)
    setSaving(false)
    setCancelled(false)
    setError('')
    setResult(null)
    setApplied(false)
    setTrace(null)
  }

  return {
    generating,
    saving,
    cancelled,
    error,
    result,
    applied,
    trace,
    generate,
    apply,
    abort,
    reset
  }
}
