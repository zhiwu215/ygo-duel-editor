import { useEffect, useState } from 'react'
import { alertDialog, promptDialog } from '../stores/useDialogStore'

export function useCustomSetcodeNames(): {
  names: Record<string, string>
  rename: (codeHex: string) => Promise<void>
} {
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void window.api
      .getCustomSetcodeNames()
      .then((result) => {
        if (!cancelled) setNames(result)
      })
      .catch((err) => {
        console.error('[useCustomSetcodeNames] load failed:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rename = async (codeHex: string): Promise<void> => {
    const code = codeHex.toUpperCase()
    const value = await promptDialog({
      title: `字段名称 0x${code}`,
      placeholder: '例如：我的系列（只用于本地显示）',
      confirmText: '保存',
      initialValue: names[code] ?? ''
    })
    if (value === null) return
    try {
      const result = await window.api.renameCustomSetcode(code, value.trim())
      if (!result.success) {
        await alertDialog(result.error || '保存字段名称失败')
        return
      }
      if (result.names) setNames(result.names)
    } catch (err) {
      console.error('[useCustomSetcodeNames] rename failed:', err)
      await alertDialog('保存字段名称失败')
    }
  }

  return { names, rename }
}
