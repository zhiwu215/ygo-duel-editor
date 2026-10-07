import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { memo, useState, type JSX } from 'react'
import {
  BookOpen,
  CheckCheck,
  ChevronRight,
  Info,
  Layers,
  LayoutGrid,
  ListOrdered,
  MousePointerClick,
  Play,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Swords,
  Wand2
} from 'lucide-react'
import type { AgentToolCallItem } from '../../stores/useAgentStore'
import { cn } from '../../lib/utils'

type ToolStatus = 'running' | 'done' | 'failed' | 'stopped'

const TOOL_LABELS: Record<string, string> = {
  get_current_board: '读取当前盘面',
  get_deck_list: '读取牌堆清单',
  search_cards: '搜索卡片',
  get_card_info: '查询卡片详情',
  find_cards_by_intent: '按意图检索卡片',
  read_novel_source: '读取小说素材',
  propose_duel_steps: '整理决斗步骤',
  propose_board_setup: '复盘场面布局',
  propose_card_replacement: '替换手牌与盖卡提案',
  validate_with_ocgcore: '校验战术规则',
  duel_engine_arrange_deck: '编排牌序',
  duel_engine_start: '引擎开局',
  duel_engine_choose: '引擎选择',
  duel_engine_commit: '提交对局步骤',
  screenplay_submit_outline: '提交剧本大纲',
  screenplay_submit_act: '提交本幕步骤',
  duel_export_replay: '导出回放'
}

const FALLBACK_ICON = <Sliders className="h-3 w-3 shrink-0 text-muted-foreground" />

const TOOL_ICONS: Record<string, JSX.Element> = {
  get_current_board: <LayoutGrid className="h-3 w-3 shrink-0 text-muted-foreground" />,
  get_deck_list: <Layers className="h-3 w-3 shrink-0 text-muted-foreground" />,
  search_cards: <Search className="h-3 w-3 shrink-0 text-muted-foreground" />,
  get_card_info: <Info className="h-3 w-3 shrink-0 text-muted-foreground" />,
  find_cards_by_intent: <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />,
  read_novel_source: <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />,
  propose_duel_steps: <ListOrdered className="h-3 w-3 shrink-0 text-muted-foreground" />,
  propose_board_setup: <Wand2 className="h-3 w-3 shrink-0 text-muted-foreground" />,
  propose_card_replacement: <Wand2 className="h-3 w-3 shrink-0 text-muted-foreground" />,
  validate_with_ocgcore: <ShieldCheck className="h-3 w-3 shrink-0 text-muted-foreground" />,
  duel_engine_arrange_deck: <Swords className="h-3 w-3 shrink-0 text-muted-foreground" />,
  duel_engine_start: <Play className="h-3 w-3 shrink-0 text-muted-foreground" />,
  duel_engine_choose: <MousePointerClick className="h-3 w-3 shrink-0 text-muted-foreground" />,
  duel_engine_commit: <CheckCheck className="h-3 w-3 shrink-0 text-muted-foreground" />,
  screenplay_submit_outline: <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />,
  screenplay_submit_act: <ListOrdered className="h-3 w-3 shrink-0 text-muted-foreground" />,
  duel_export_replay: <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
}

const STATUS_TEXT: Record<ToolStatus, string> = {
  running: '执行中',
  done: '已执行',
  failed: '执行失败',
  stopped: '已停止'
}

const FAILURE_PATTERN =
  /失败|错误|异常|未提供|未找到|未能|无法|被拒绝|未就绪|跳过|尚未|超时|为空|未附加/

const MAX_DETAIL_CHARS = 4000

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName
}

function getToolIcon(toolName: string): JSX.Element {
  return TOOL_ICONS[toolName] ?? FALLBACK_ICON
}

function isFailureSummary(summary: string): boolean {
  return FAILURE_PATTERN.test(summary)
}

function resolveStatus(call: AgentToolCallItem, isStreaming: boolean): ToolStatus {
  if (call.resultSummary) return isFailureSummary(call.resultSummary) ? 'failed' : 'done'
  return isStreaming ? 'running' : 'stopped'
}

function getToolParamsSummary(tool: AgentToolCallItem): string | null {
  if (tool.toolName === 'search_cards' && typeof tool.params.keyword === 'string') {
    return `关键词：${tool.params.keyword}`
  }
  if (
    tool.toolName === 'find_cards_by_intent' &&
    Array.isArray(tool.params.keywords) &&
    tool.params.keywords.length > 0
  ) {
    const words = tool.params.keywords.slice(0, 4).join(' / ')
    return `按「${words}」找功能卡`
  }
  if (tool.toolName === 'get_card_info' && Array.isArray(tool.params.codes)) {
    const codes = tool.params.codes
    return `卡密：${codes.slice(0, 5).join(', ')}${codes.length > 5 ? ` 等 ${codes.length} 张` : ''}`
  }
  if (tool.toolName === 'read_novel_source') {
    const offset = typeof tool.params.offset === 'number' ? tool.params.offset : 0
    return offset > 0 ? `续读：第 ${offset} 字起` : '从头通读素材'
  }
  if (tool.toolName === 'propose_board_setup') {
    const cardCount = typeof tool.params.cardCount === 'number' ? tool.params.cardCount : null
    if (cardCount !== null) {
      return `${tool.params.clearExisting ? '清空后摆' : '叠加摆放'} ${cardCount} 张卡`
    }
  }
  if (
    (tool.toolName === 'validate_with_ocgcore' ||
      tool.toolName === 'propose_duel_steps' ||
      tool.toolName === 'propose_card_replacement') &&
    typeof tool.params.summary === 'string'
  ) {
    return tool.params.summary
  }
  return null
}

function formatParams(params: Record<string, unknown>): string | null {
  if (Object.keys(params).length === 0) return null
  try {
    const raw = JSON.stringify(params, null, 2)
    return raw.length > MAX_DETAIL_CHARS ? `${raw.slice(0, MAX_DETAIL_CHARS)}…` : raw
  } catch {
    return null
  }
}

function StatusWord({
  status,
  tooltip
}: {
  status: ToolStatus
  tooltip?: string | undefined
}): JSX.Element {
  if (status === 'failed' && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="shrink-0 cursor-help whitespace-nowrap text-muted-foreground underline decoration-dotted underline-offset-2">
              {STATUS_TEXT[status]}
            </span>
          }
        />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }
  if (status === 'running') {
    return (
      <span className="animated-gradient-text shrink-0 whitespace-nowrap">
        {STATUS_TEXT[status]}
      </span>
    )
  }
  return (
    <span className="shrink-0 whitespace-nowrap text-muted-foreground">{STATUS_TEXT[status]}</span>
  )
}

function ToolCallRow({
  call,
  status
}: {
  call: AgentToolCallItem
  status: ToolStatus
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const icon = getToolIcon(call.toolName)
  const paramsSummary = getToolParamsSummary(call)
  const secondary = call.resultSummary ?? paramsSummary ?? null
  const paramsText = formatParams(call.params)
  const canToggle = Boolean(call.resultSummary || paramsText)

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={canToggle ? open : undefined}
        onClick={() => canToggle && setOpen((current) => !current)}
        className={cn(
          'flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] transition-colors',
          canToggle ? 'hover:bg-muted/60' : 'cursor-default'
        )}
      >
        {icon}
        <span
          className={cn(
            'shrink-0 whitespace-nowrap font-medium',
            status === 'running' ? 'animated-gradient-text' : 'text-foreground/80'
          )}
        >
          {getToolLabel(call.toolName)}
        </span>
        {secondary && !open ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{secondary}</span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <StatusWord status={status} tooltip={call.resultSummary} />
        {canToggle && (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-90'
            )}
          />
        )}
      </button>

      {open && (
        <div className="ml-2 mt-0.5 space-y-1 border-l border-border pl-3">
          {call.resultSummary && (
            <div className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {call.resultSummary}
            </div>
          )}
          {paramsText && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 px-1.5 py-1 font-mono text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {paramsText}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function ToolCallGroup({
  calls,
  isStreaming
}: {
  calls: AgentToolCallItem[]
  isStreaming: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const statuses = calls.map((call) => resolveStatus(call, isStreaming))
  const failedCount = statuses.filter((status) => status === 'failed').length
  const lastRunningIndex = statuses.lastIndexOf('running')
  const runningCall = lastRunningIndex >= 0 ? calls[lastRunningIndex] : null

  const counts = new Map<string, number>()
  for (const call of calls) {
    counts.set(call.toolName, (counts.get(call.toolName) ?? 0) + 1)
  }
  const countSummary = Array.from(
    counts,
    ([toolName, count]) => `${getToolLabel(toolName)} ×${count}`
  ).join(' · ')

  return (
    <div className="mb-2 min-w-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-expanded={open}

              onClick={() => setOpen((current) => !current)}
              className="flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] transition-colors hover:bg-muted/60"
            >
              <Sliders className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="shrink-0 whitespace-nowrap font-medium text-foreground/80">
                工具调用
              </span>
              {runningCall ? (
                <>
                  <span className="animated-gradient-text min-w-0 flex-1 truncate">
                    {getToolLabel(runningCall.toolName)}
                  </span>
                  <StatusWord status="running" />
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {calls.length} 个工具
                    {failedCount > 0 ? ` · ${failedCount} 个失败` : ''}
                  </span>
                </>
              )}
              <ChevronRight
                className={cn(
                  'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-90'
                )}
              />
            </button>
          }
        />
        <TooltipContent>{countSummary}</TooltipContent>
      </Tooltip>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {calls.map((call, index) => (
            <ToolCallRow key={call.id} call={call} status={statuses[index]} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolCallListImpl({
  calls,
  isStreaming
}: {
  calls: AgentToolCallItem[]
  isStreaming: boolean
}): JSX.Element | null {
  if (calls.length === 0) return null
  if (calls.length === 1) {
    return (
      <div className="mb-2">
        <ToolCallRow call={calls[0]} status={resolveStatus(calls[0], isStreaming)} />
      </div>
    )
  }
  return <ToolCallGroup calls={calls} isStreaming={isStreaming} />
}

export const ToolCallList = memo(ToolCallListImpl)
