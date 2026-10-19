import { useEffect, useState } from 'react'
import { CustomCardScriptInfo } from '@shared/index'

interface StagedImage {
  path: string
  preview: string
}

interface UseCustomCardScriptParams {
  editingId: number | null
  reportError: (message: string) => void
}

export function useCustomCardScript({ editingId, reportError }: UseCustomCardScriptParams): {
  staged: StagedImage | null
  picking: boolean
  handlePickImage: () => Promise<void>
  scriptInfo: CustomCardScriptInfo | null
  scriptBusy: boolean
  scriptError: string
  handlePickScript: () => Promise<void>
  handleRemoveScript: () => Promise<void>
} {
  const [staged, setStaged] = useState<StagedImage | null>(null)
  const [picking, setPicking] = useState<boolean>(false)
  const [scriptInfo, setScriptInfo] = useState<CustomCardScriptInfo | null>(null)
  const [scriptBusy, setScriptBusy] = useState<boolean>(false)
  const [scriptError, setScriptError] = useState<string>('')

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

  const handlePickImage = async (): Promise<void> => {
    setPicking(true)
    try {
      const res = await window.api.pickCustomCardImage()
      if (!res.success && res.error) {
        reportError(res.error)
      } else if (res.success && res.filePath) {
        setStaged({ path: res.filePath, preview: res.previewDataUrl ?? '' })
        reportError('')
      }
    } finally {
      setPicking(false)
    }
  }

  const handlePickScript = async (): Promise<void> => {
    if (editingId === null) return
    setScriptBusy(true)
    try {
      const res = await window.api.pickCustomCardScript(editingId)
      if (res.canceled) return
      if (!res.success) {
        setScriptError(res.error ?? '脚本导入失败')
        return
      }
      setScriptInfo(res.info ?? null)
      setScriptError('')
    } finally {
      setScriptBusy(false)
    }
  }

  const handleRemoveScript = async (): Promise<void> => {
    if (editingId === null) return
    setScriptBusy(true)
    try {
      const res = await window.api.deleteCustomCardScript(editingId)
      if (!res.success) {
        setScriptError(res.error ?? '脚本删除失败')
        return
      }
      setScriptInfo(res.info ?? null)
      setScriptError('')
    } finally {
      setScriptBusy(false)
    }
  }

  return {
    staged,
    picking,
    handlePickImage,
    scriptInfo,
    scriptBusy,
    scriptError,
    handlePickScript,
    handleRemoveScript
  }
}
