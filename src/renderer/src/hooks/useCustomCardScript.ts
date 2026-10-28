import { useCallback, useEffect, useState } from 'react'
import { CustomCardScriptInfo, CustomCardScriptPickResult } from '@shared/index'

export interface StagedScript {
  filePath: string
  fileName: string
  suggestedId?: number
  stringIds: number[]
  size?: number
}

interface UseCustomCardScriptParams {
  editingId: number | null
}

export function useCustomCardScript({ editingId }: UseCustomCardScriptParams): {
  stagedScript: StagedScript | null
  scriptInfo: CustomCardScriptInfo | null
  scriptBusy: boolean
  scriptError: string
  scriptNotice: string
  usedStringIds: number[]
  pickScript: () => Promise<CustomCardScriptPickResult | null>
  reloadScript: () => Promise<void>
  dropStaged: () => void
  removeScript: () => Promise<void>
} {
  const [stagedScript, setStagedScript] = useState<StagedScript | null>(null)
  const [scriptInfo, setScriptInfo] = useState<CustomCardScriptInfo | null>(null)
  const [scriptBusy, setScriptBusy] = useState<boolean>(false)
  const [scriptError, setScriptError] = useState<string>('')
  const [scriptNotice, setScriptNotice] = useState<string>('')

  useEffect(() => {
    if (editingId === null) return
    let cancelled = false
    void window.api
      .getCustomCardScript(editingId)
      .then((info) => {
        if (!cancelled) setScriptInfo(info)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [editingId])

  const pickScript = async (): Promise<CustomCardScriptPickResult | null> => {
    setScriptBusy(true)
    setScriptError('')
    setScriptNotice('')
    try {
      const picked = await window.api.pickCustomCardScriptFile()
      if (picked.canceled) return null
      if (!picked.success || !picked.filePath) {
        setScriptError(picked.error ?? '脚本选择失败')
        return null
      }

      if (editingId !== null) {
        const imported = await window.api.importCustomCardScript(editingId, picked.filePath)
        if (!imported.success) {
          setScriptError(imported.error ?? '脚本导入失败')
          return null
        }
        setScriptInfo(imported.info ?? null)
        setScriptNotice(imported.warning ?? '')
        return picked
      }

      setStagedScript({
        filePath: picked.filePath,
        fileName: picked.fileName ?? '',
        suggestedId: picked.suggestedId,
        stringIds: picked.stringIds ?? [],
        size: picked.size
      })
      return picked
    } finally {
      setScriptBusy(false)
    }
  }

  const reloadScript = useCallback(async (): Promise<void> => {
    if (editingId === null) return
    const info = await window.api.getCustomCardScript(editingId)
    setScriptInfo(info)
  }, [editingId])

  const dropStaged = (): void => {
    setStagedScript(null)
  }

  const removeScript = async (): Promise<void> => {
    if (editingId === null) {
      setStagedScript(null)
      setScriptError('')
      setScriptNotice('')
      return
    }
    setScriptBusy(true)
    try {
      const result = await window.api.deleteCustomCardScript(editingId)
      if (!result.success) {
        setScriptError(result.error ?? '脚本删除失败')
        return
      }
      setScriptInfo(result.info ?? null)
      setScriptError('')
      setScriptNotice('')
    } finally {
      setScriptBusy(false)
    }
  }

  return {
    stagedScript,
    scriptInfo,
    scriptBusy,
    scriptError,
    scriptNotice,
    usedStringIds: scriptInfo?.stringIds ?? stagedScript?.stringIds ?? [],
    pickScript,
    reloadScript,
    dropStaged,
    removeScript
  }
}
