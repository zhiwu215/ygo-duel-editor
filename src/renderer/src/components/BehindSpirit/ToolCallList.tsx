import { useState, type JSX } from 'react'
import { ChevronDown, ChevronRight, Loader2, Sliders } from 'lucide-react'
import type { AgentToolCallItem } from '../../stores/useAgentStore'

const TOOL_LABELS: Record<string, string> = {
  get_current_board: '读取当前盘面',
  search_cards: '搜索卡片',
  get_card_info: '查询卡片详情',
  propose_duel_steps: '整理决斗步骤',
  validate_with_ocgcore: '校验战术规则'
}

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName
}

function getToolParamsSummary(tool: AgentToolCallItem): string | null {
  if (tool.toolName === 'search_cards' && typeof tool.params.keyword === 'string') {
    return `关键词：${tool.params.keyword}`
  }
  if (tool.toolName === 'get_card_info' && Array.isArray(tool.params.codes)) {
    const codes = tool.params.codes
    return `卡密：${codes.slice(0, 5).join(', ')}${codes.length > 5 ? ` 等 ${codes.length} 张` : ''}`
  }
  if (
    (tool.toolName === 'validate_with_ocgcore' || tool.toolName === 'propose_duel_steps') &&
    typeof tool.params.summary === 'string'
  ) {
    return tool.params.summary
  }
  return null
}

function ToolCallRow({
  tool,
  isRunning
}: {
  tool: AgentToolCallItem
  isRunning: boolean
}): JSX.Element {
  const paramsSummary = getToolParamsSummary(tool)

  return (
    <div className="rounded bg-neutral-200/50 dark:bg-neutral-800/60 px-2 py-1.5 text-[10px] text-neutral-600 dark:text-neutral-300">
      <div className="flex min-w-0 items-center gap-1.5">
        <Sliders className="w-3 h-3 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-semibold">{getToolLabel(tool.toolName)}</span>
        {isRunning ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            执行中
          </span>
        ) : tool.resultSummary ? (
          <span className="min-w-0 truncate text-muted-foreground">{tool.resultSummary}</span>
        ) : (
          <span className="ml-auto shrink-0 text-muted-foreground">未完成</span>
        )}
      </div>
      {paramsSummary && (
        <div className="mt-1 truncate pl-[18px] text-muted-foreground">{paramsSummary}</div>
      )}
    </div>
  )
}

export function ToolCallList({
  calls,
  isGenerating
}: {
  calls: AgentToolCallItem[]
  isGenerating: boolean
}): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  if (calls.length === 0) return null

  const runningCount = isGenerating ? calls.filter((call) => !call.resultSummary).length : 0

  if (calls.length === 1) {
    return (
      <div className="mb-2">
        <ToolCallRow tool={calls[0]} isRunning={runningCount > 0} />
      </div>
    )
  }

  const counts = new Map<string, number>()
  for (const call of calls) {
    counts.set(call.toolName, (counts.get(call.toolName) ?? 0) + 1)
  }
  const summary = Array.from(
    counts,
    ([toolName, count]) => `${getToolLabel(toolName)} ×${count}`
  ).join(' · ')

  return (
    <div className="mb-2">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-md bg-neutral-200/50 px-2 py-1.5 text-left text-[10px] text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Sliders className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-semibold">工具调用</span>
        <span className="shrink-0 rounded bg-background/70 px-1 py-0.5 font-mono">
          {calls.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{summary}</span>
        {runningCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {runningCount} 执行中
          </span>
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 max-h-44 space-y-1 overflow-y-auto pl-2">
          {calls.map((tool) => (
            <ToolCallRow
              key={tool.id}
              tool={tool}
              isRunning={isGenerating && !tool.resultSummary}
            />
          ))}
        </div>
      )}
    </div>
  )
}
