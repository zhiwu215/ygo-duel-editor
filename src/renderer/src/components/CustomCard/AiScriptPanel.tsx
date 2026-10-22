import React from 'react'
import { Check } from 'lucide-react'
import type {
  CustomCard,
  CustomCardScriptGenerateResult,
  CustomScriptTestReport
} from '@shared/index'
import { Button } from '../ui/button'
import { useCustomCardScriptGeneration } from '../../hooks/useCustomCardScriptGeneration'

interface AiScriptPanelProps {
  card: CustomCard
  onEnsureId: (id: number) => void
  onApplied: (result: CustomCardScriptGenerateResult) => void
}

function reportColor(report: CustomScriptTestReport | undefined): string {
  if (!report) return 'text-muted-foreground'
  return report.ok ? 'text-emerald-500' : 'text-red-500'
}

export const AiScriptPanel: React.FC<AiScriptPanelProps> = ({ card, onEnsureId, onApplied }) => {
  const { busy, error, result, applied, generate, apply } = useCustomCardScriptGeneration()

  const handleGenerate = async (): Promise<void> => {
    await generate({ card, onEnsureId })
  }

  const handleApply = async (): Promise<void> => {
    const appliedResult = await apply(card)
    if (appliedResult) onApplied(appliedResult)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">AI 脚本</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="ml-auto"
          disabled={busy}
          onClick={() => void handleGenerate()}
        >
          {busy ? '生成中…' : result ? '重新生成' : 'AI 生成 Lua'}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        根据效果文本生成脚本，并在 ocgcore 中实际加载、启动对局和检查脚本错误。
      </p>
      {result?.report && (
        <div className={`text-[11px] leading-relaxed ${reportColor(result.report)}`}>
          {result.report.summary}
          {result.report.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-red-500">
              {result.report.errors.slice(0, 4).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result?.script && (
        <textarea
          readOnly
          value={result.script}
          spellCheck={false}
          className="h-40 w-full resize-y rounded-md border border-border/60 bg-background/60 p-2 font-mono text-[length:var(--code-font-size)] leading-relaxed text-foreground/85"
        />
      )}
      {result && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {result.category !== undefined && <span>分类：{result.category}</span>}
          {result.strings?.some((text) => text.trim()) && <span>已生成 strings</span>}
        </div>
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
            <span>{applied ? '已应用' : '应用脚本'}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
