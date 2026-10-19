import React, { useState } from 'react'
import { AgentModelConfig, AgentProviderModelConfig } from '@shared/index'
import { useAgentStore } from '../../../stores/useAgentStore'
import { Textarea } from '../../ui/textarea'
import { Checkbox } from '../../ui/checkbox'

interface ChatSettingsSectionProps {
  config: AgentModelConfig
  activeModelInfo: AgentProviderModelConfig | null
}

export function ChatSettingsSection({
  config,
  activeModelInfo
}: ChatSettingsSectionProps): React.JSX.Element {
  const { updateConfig, saveConfig } = useAgentStore()
  const [promptDraft, setPromptDraft] = useState<string | null>(null)
  const [contextDraft, setContextDraft] = useState<string | null>(null)
  const [maxTokensDraft, setMaxTokensDraft] = useState<string | null>(null)

  const apply = (patch: Partial<AgentModelConfig>): void => {
    updateConfig(patch)
    void saveConfig()
  }

  const promptValue = promptDraft ?? config.systemPrompt ?? ''
  const contextValue = contextDraft ?? config.contextWindow ?? ''
  const maxTokensValue = maxTokensDraft ?? config.maxTokens ?? ''
  const reasoningSupported = Boolean(activeModelInfo?.supportsReasoning)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1.5">
          创作者补充背景设定 (System Instruction)
        </label>
        <Textarea
          value={promptValue}
          onChange={(e) => setPromptDraft(e.target.value)}
          onBlur={() => {
            apply({ systemPrompt: promptValue })
            setPromptDraft(null)
          }}
          placeholder="可填入决斗双方的角色性格（如海马的高傲狂妄、暗游戏的稳重热血）、作品同人世界观设定等..."
          rows={5}
          className="resize-none bg-background text-xs leading-relaxed"
        />
      </div>

      {reasoningSupported ? (
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
          <Checkbox
            checked={Boolean(config.enableReasoning)}
            onCheckedChange={(checked) => apply({ enableReasoning: checked })}
          />
          <span>启用模型推理 / 思考链 (Reasoning)</span>
        </label>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          当前模型不支持思考链；在「模型设置」中切换到支持推理的模型（如 DeepSeek
          Reasoner）后此处可启用。
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div>
          <label className="block text-[11px] font-semibold mb-1">上下文窗口 (tokens)</label>
          <input
            type="number"
            min={1024}
            step={1024}
            value={contextValue}
            onChange={(e) => setContextDraft(e.target.value)}
            onBlur={() => {
              if (contextDraft === null) return
              apply({ contextWindow: contextDraft ? Number(contextDraft) : undefined })
              setContextDraft(null)
            }}
            placeholder="131072"
            className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1">单次回复上限 (tokens)</label>
          <input
            type="number"
            min={256}
            step={256}
            value={maxTokensValue}
            onChange={(e) => setMaxTokensDraft(e.target.value)}
            onBlur={() => {
              if (maxTokensDraft === null) return
              apply({ maxTokens: maxTokensDraft ? Number(maxTokensDraft) : undefined })
              setMaxTokensDraft(null)
            }}
            placeholder="8192"
            className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono"
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1.5">
        按所选模型实际能力填写（留空使用默认值），影响 token 估算与自动压缩。失焦后自动保存。
      </p>
    </div>
  )
}
