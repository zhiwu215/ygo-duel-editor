import React from 'react'
import { Check, Square } from 'lucide-react'
import type { CustomCard, CustomCardScriptGenerateResult } from '@shared/index'
import { Button } from '../ui/button'
import { useCustomCardScriptGeneration } from '../../hooks/useCustomCardScriptGeneration'
import { AiScriptTrace } from './AiScriptTrace'

interface AiScriptPanelProps {
  card: CustomCard
  onEnsureId: (id: number) => void
  onEnsureSaved: (result: CustomCardScriptGenerateResult) => Promise<number>
  onApplied: (result: CustomCardScriptGenerateResult) => void
}

export const AiScriptPanel: React.FC<AiScriptPanelProps> = ({
  card,
  onEnsureId,
  onEnsureSaved,
  onApplied
}) => {
  const { generating, saving, cancelled, error, result, applied, trace, generate, apply, abort } =
    useCustomCardScriptGeneration()

  const handleGenerate = async (): Promise<void> => {
    await generate({ card, onEnsureId })
  }

  const handleApply = async (): Promise<void> => {
    const current = result
    if (!current) return
    const appliedResult = await apply(() => onEnsureSaved(current))
    if (appliedResult) onApplied(appliedResult)
  }

  const busy = generating || saving
  const showTrace = generating && trace !== null
  const hasCategory = result?.category !== undefined
  const hasStrings = result?.strings?.some((text) => text.trim()) === true

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">AI 脚本</span>
        {generating ? (
          <Button
            type="button"
            variant="destructive"
            size="xs"
            className="ml-auto gap-1"
            onClick={() => void abort()}
          >
            <Square className="h-3 w-3 fill-current" />
            <span>中断</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="ml-auto"
            disabled={saving}
            onClick={() => void handleGenerate()}
          >
            {result ? '重新生成' : 'AI 生成 Lua'}
          </Button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        结合相似卡官方脚本生成完整脚本，新建卡片应用脚本时会自动保存；生成后请在游戏中验证实际效果。
      </p>
      {showTrace && trace && <AiScriptTrace trace={trace} />}
      {cancelled && !generating && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">已中止生成。</p>
      )}
      {result?.script && (
        <textarea
          readOnly
          value={result.script}
          spellCheck={false}
          className="h-40 w-full resize-y rounded-md border border-border/60 bg-background/60 p-2 font-mono text-[length:var(--code-font-size)] leading-relaxed text-foreground/85"
        />
      )}
      {(hasCategory || hasStrings) && result && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {hasCategory && <span>分类：{result.category}</span>}
          {hasStrings && <span>已生成 strings</span>}
        </div>
      )}
      {result?.notes && (
        <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {result.notes}
        </p>
      )}
      {error && <p className="text-[11px] leading-relaxed text-red-500">{error}</p>}
      {result?.script && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="xs"
            className="gap-1"
            disabled={busy || applied}
            onClick={() => void handleApply()}
          >
            <Check className="h-3 w-3" />
            <span>{saving ? '应用中…' : applied ? '已应用' : '应用脚本'}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
