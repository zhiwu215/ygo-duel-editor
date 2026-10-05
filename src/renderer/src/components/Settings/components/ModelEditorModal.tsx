import React, { useEffect, useState } from 'react'
import { Check, ChevronRight, Loader2, Lock, X } from 'lucide-react'
import { AgentProviderConfig, AgentProviderModelConfig, cleanAgentApiKey } from '@shared/index'
import { Button } from '../../ui/button'
import { Switch } from '../../ui/switch'
import { HelpTip } from './HelpTip'
import { cn } from '../../../lib/utils'

interface ModelEditorModalProps {
  /** add = 新增模型，edit = 修改已有模型 */
  mode: 'add' | 'edit'
  /** 所属供应商，用于「智能配置」拉取厂商模型元数据 */
  provider: AgentProviderConfig
  /** 编辑态传入被编辑的模型 */
  initial: AgentProviderModelConfig | null
  /** 已被占用的模型 ID（编辑态已排除自身），用于查重 */
  existingIds: string[]
  onClose: () => void
  onSubmit: (model: AgentProviderModelConfig) => void
}

const FIELD_INPUT_CLASS =
  'w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-[11px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25'

/** 折叠区里的分组小标题，对齐 ZCode 的「输入类型 / 模型能力」写法 */
function GroupLabel({ label, help }: { label: string; help: string }): React.JSX.Element {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <HelpTip text={help} />
    </div>
  )
}

/** ZCode 那种「方框 + 文字」的复选芯片 */
function OptionChip({
  label,
  selected,
  locked,
  onToggle
}: {
  label: string
  selected: boolean
  /** 置灰且不可点（如「文本」这种恒定能力） */
  locked?: boolean
  onToggle?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={locked}
      onClick={onToggle}
      className={cn(
        'flex h-7 items-center gap-2 px-3 rounded-lg border border-border text-[11px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
        selected ? 'bg-foreground/10' : 'bg-transparent hover:bg-muted/60',
        locked && 'cursor-default'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-sm border',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background'
        )}
      >
        {selected && <Check className="w-2.5 h-2.5" />}
      </span>
      <span>{label}</span>
      {locked && <Lock className="w-3 h-3 shrink-0 text-muted-foreground/60" />}
    </button>
  )
}

function toNumberText(value?: number): string {
  return typeof value === 'number' && value > 0 ? String(value) : ''
}

/**
 * 添加 / 编辑模型的弹窗。
 * 结构参照 ZCode 的 ProviderModelMetadataDialog：智能配置 → 模型 ID → 上下文窗口 →
 * 最大输出 Token → 折叠的「高级配置」（输入类型 / 模型能力 / 推理），
 * 底部「重置表单 / 取消 / 保存」。
 *
 * 只列本项目底层（pi）真正支持的项：pi 的模型配置只有 text / image 两种模态，
 * 也没有「原生联网搜索」开关，所以不摆「视频 / PDF / 原生联网搜索」这些点了没反应的选项。
 */
export const ModelEditorModal: React.FC<ModelEditorModalProps> = ({
  mode,
  provider,
  initial,
  existingIds,
  onClose,
  onSubmit
}) => {
  const [idValue, setIdValue] = useState(initial?.id ?? '')
  const [nameValue, setNameValue] = useState(initial?.name ?? '')
  const [contextValue, setContextValue] = useState(toNumberText(initial?.contextWindow))
  const [maxTokensValue, setMaxTokensValue] = useState(toNumberText(initial?.maxTokens))
  const [reasoning, setReasoning] = useState(Boolean(initial?.supportsReasoning))
  const [vision, setVision] = useState(Boolean(initial?.supportsVision))
  const [structuredOutput, setStructuredOutput] = useState(
    Boolean(initial?.supportsStructuredOutput)
  )
  const [midConversationSystem, setMidConversationSystem] = useState(
    Boolean(initial?.supportsMidConversationSystem)
  )
  /** 智能配置：按模型 ID 从厂商接口自动识别上下文窗口与能力 */
  const [smart, setSmart] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detectNote, setDetectNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const detectModel = async (): Promise<void> => {
    const id = idValue.trim()
    if (!smart || !id || !provider.baseUrl.trim() || !window.api?.agentFetchModels) return
    setDetecting(true)
    setDetectNote('')
    try {
      const res = await window.api.agentFetchModels({
        baseUrl: provider.baseUrl,
        apiKey: cleanAgentApiKey(provider.apiKey)
      })
      const hit = res.success ? res.models?.find((m) => m.id === id) : undefined
      if (!hit) {
        setDetectNote('未能在厂商接口中找到该模型，请手动填写')
        return
      }
      if (hit.contextWindow) setContextValue(String(hit.contextWindow))
      setReasoning(Boolean(hit.supportsReasoning))
      setVision(Boolean(hit.supportsVision))
      setDetectNote('已按厂商接口自动识别该模型的配置')
    } finally {
      setDetecting(false)
    }
  }

  const handleReset = (): void => {
    setIdValue(initial?.id ?? '')
    setNameValue(initial?.name ?? '')
    setContextValue(toNumberText(initial?.contextWindow))
    setMaxTokensValue(toNumberText(initial?.maxTokens))
    setReasoning(Boolean(initial?.supportsReasoning))
    setVision(Boolean(initial?.supportsVision))
    setStructuredOutput(Boolean(initial?.supportsStructuredOutput))
    setMidConversationSystem(Boolean(initial?.supportsMidConversationSystem))
    setSmart(true)
    setDetectNote('')
    setError('')
  }

  const handleSubmit = (): void => {
    const id = idValue.trim()
    if (!id) {
      setError('请填写模型 ID')
      return
    }
    if (existingIds.includes(id)) {
      setError(`模型「${id}」已存在`)
      return
    }
    const contextWindow = contextValue.trim() ? Number(contextValue) : undefined
    if (contextWindow !== undefined && (!Number.isFinite(contextWindow) || contextWindow <= 0)) {
      setError('上下文窗口需填写正整数')
      return
    }
    const maxTokens = maxTokensValue.trim() ? Number(maxTokensValue) : undefined
    if (maxTokens !== undefined && (!Number.isFinite(maxTokens) || maxTokens <= 0)) {
      setError('最大输出 Token 需填写正整数')
      return
    }
    onSubmit({
      id,
      name: nameValue.trim() || undefined,
      contextWindow,
      maxTokens,
      supportsReasoning: reasoning,
      supportsVision: vision,
      supportsStructuredOutput: structuredOutput,
      supportsMidConversationSystem: midConversationSystem,
      enabled: initial?.enabled ?? true,
      // 必须标记 custom，否则 normalizeAgentConfig 会把这条模型丢掉
      custom: true
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-card text-card-foreground border border-border rounded-xl shadow-2xl select-none animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h3 className="text-xs font-semibold">{mode === 'add' ? '添加模型' : '编辑模型'}</h3>
          <button
            type="button"
            onClick={onClose}
            title="关闭 (Esc)"
            className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-5 pt-3">
          <span className="text-[11px] font-medium">智能配置</span>
          <HelpTip text="开启后，填好模型 ID 会自动从厂商接口读取该模型的上下文窗口与能力；识别不到时可手动填写" />
          <Switch
            checked={smart}
            onCheckedChange={setSmart}
            aria-label="智能配置"
            className="ml-1"
          />
          {detecting && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">模型 ID</label>
            <input
              autoFocus
              type="text"
              value={idValue}
              onChange={(e) => setIdValue(e.target.value)}
              onBlur={() => void detectModel()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit()
              }}
              placeholder="模型 ID"
              spellCheck={false}
              className={cn(FIELD_INPUT_CLASS, 'font-mono')}
            />
          </div>

          <div>
            <span className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              模型名称
              <HelpTip text="仅用于界面展示，留空时显示模型 ID" />
            </span>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit()
              }}
              placeholder="可选"
              className={FIELD_INPUT_CLASS}
            />
          </div>

          <div>
            <span className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              上下文窗口
              <HelpTip text="模型单次能处理的最大 token 数，影响上下文自动压缩阈值" />
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={contextValue}
              onChange={(e) => setContextValue(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="如 131072"
              className={cn(FIELD_INPUT_CLASS, 'font-mono')}
            />
          </div>

          <div>
            <span className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              最大输出 Token
              <HelpTip text="该模型单次回复的上限，留空则使用「对话设置」里的全局上限" />
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={maxTokensValue}
              onChange={(e) => setMaxTokensValue(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="如 8192"
              className={cn(FIELD_INPUT_CLASS, 'font-mono')}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="flex w-fit items-center gap-1.5 py-1 text-[11px] font-medium text-foreground hover:text-muted-foreground transition-colors"
            >
              <ChevronRight
                className={cn('w-3.5 h-3.5 transition-transform', advancedOpen && 'rotate-90')}
              />
              <span>高级配置</span>
            </button>

            {advancedOpen && (
              <div className="mt-2 space-y-4 pl-5">
                <div>
                  <GroupLabel
                    label="输入类型"
                    help="该模型能接收的内容类型。文本是所有模型都支持的；图片需要模型本身具备视觉能力"
                  />
                  <div className="flex flex-wrap gap-2">
                    <OptionChip label="文本" selected locked />
                    <OptionChip
                      label="图片"
                      selected={vision}
                      onToggle={() => setVision((v) => !v)}
                    />
                  </div>
                </div>

                <div>
                  <GroupLabel
                    label="模型能力"
                    help="直接写进底层引擎的兼容性声明。只有确认模型确实支持时才开启，否则可能导致工具调用异常"
                  />
                  <div className="flex flex-wrap gap-2">
                    <OptionChip
                      label="结构化输出"
                      selected={structuredOutput}
                      onToggle={() => setStructuredOutput((v) => !v)}
                    />
                    <OptionChip
                      label="对话中系统消息"
                      selected={midConversationSystem}
                      onToggle={() => setMidConversationSystem((v) => !v)}
                    />
                  </div>
                </div>

                <div>
                  <GroupLabel
                    label="推理"
                    help="开启后该模型会出现在「对话设置」的可推理模型里，并在模型列表打「推理」标记"
                  />
                  <div className="flex flex-wrap gap-2">
                    <OptionChip
                      label="支持推理 / 思考链"
                      selected={reasoning}
                      onToggle={() => setReasoning((v) => !v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {detectNote && <p className="text-[10px] text-muted-foreground">{detectNote}</p>}

          {error && (
            <div className="px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-[11px] text-destructive break-all">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            重置表单
          </button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
