import React, { useState } from 'react'
import { FolderOpen, Loader2, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { useConfigStore } from '../../stores/useConfigStore'

const INFO_ROWS: Array<{ label: string; value: string }> = [
  { label: '作者', value: '知兀' },
  { label: '邮箱', value: 'zhiwu_215@qq.com' },
  { label: 'B 站', value: 'space.bilibili.com/3546704263514722' },
  { label: '项目地址', value: 'github.com/zhiwu215/ygo-duel-editor' }
]

export const CdbSetupModal: React.FC = () => {
  const { dbReady, selectYgoDir } = useConfigStore()
  const [busy, setBusy] = useState<boolean>(false)
  const [copied, setCopied] = useState<string | null>(null)

  if (dbReady !== false) {
    return null
  }

  const handleSelect = async (): Promise<void> => {
    setBusy(true)
    await selectYgoDir()
    setBusy(false)
  }

  const handleCopy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-150 select-none">
      <div className="w-[460px] max-w-full bg-card border border-border rounded-xl shadow-2xl p-8 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-150">
        <h2 className="text-base font-bold text-foreground">欢迎使用 ygo-duel-editor</h2>

        <div className="w-full space-y-2 text-xs">
          {INFO_ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground shrink-0">{row.label}</span>
              <button
                type="button"
                onClick={() => void handleCopy(row.value)}
                title="点击复制"
                className="flex items-center gap-1 text-foreground hover:text-foreground/70 transition-colors cursor-pointer"
              >
                <span>{row.value}</span>
                {copied === row.value ? (
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <span className="w-3 h-3 shrink-0" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="w-full h-px bg-border/60" />

        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          用户未设置默认 ygo 路径，请设置
        </p>

        <Button
          size="sm"
          onClick={() => void handleSelect()}
          disabled={busy}
          className="h-9 px-6 text-xs gap-1.5 font-semibold"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5" />
          )}
          <span>确定</span>
        </Button>
      </div>
    </div>
  )
}
