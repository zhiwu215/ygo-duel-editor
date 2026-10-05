import type { JSX } from 'react'
import { Swords, Layers, MessageSquare, Eye, Activity, User } from 'lucide-react'
import { AgentStepProposal, PHASE_SHORT_NAMES, ACTION_TYPE_NAMES } from '@shared/index'

export interface AiProposalCardProps {
  proposal: AgentStepProposal
  index: number
}

export function AiProposalCard({ proposal, index }: AiProposalCardProps): JSX.Element {
  const {
    actionPlayer,
    phase,
    actionType,
    turn,
    chainIndex,
    cardName,
    cardCode,
    description,
    dialogue,
    speaker,
    innerThoughts,
    lpChange
  } = proposal

  const isP0 = actionPlayer === 0
  const phaseName = PHASE_SHORT_NAMES[phase] || phase
  const actionName = ACTION_TYPE_NAMES[actionType] || actionType

  return (
    <div className="border border-border/80 rounded-lg p-3 bg-card/60 hover:bg-card/90 transition-colors shadow-xs text-xs space-y-2">
      {/* 头部元数据 */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono px-1.5 py-0.5 rounded text-[10px] bg-muted text-foreground font-bold">
            步骤 {index + 1}
          </span>
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            第 {turn} 回合
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">|</span>
          <span className="text-neutral-600 dark:text-neutral-400">{phaseName}</span>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isP0
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            }`}
          >
            {isP0 ? '我方' : '对方'}
          </span>
        </div>
      </div>

      {/* 动作核心信息 */}
      <div className="flex items-start gap-2">
        <div className="p-1 rounded bg-neutral-200/50 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 mt-0.5">
          {actionType === 'ATTACK' ? (
            <Swords className="w-3.5 h-3.5" />
          ) : actionType === 'DIALOGUE' ? (
            <MessageSquare className="w-3.5 h-3.5" />
          ) : (
            <Layers className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">
              【{actionName}】
            </span>
            {chainIndex !== undefined && (
              <span className="text-[10px] px-1 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono font-semibold">
                C{chainIndex}
              </span>
            )}
            {cardName && <span className="font-semibold text-foreground truncate">{cardName}</span>}
            {cardCode && (
              <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                ({cardCode})
              </span>
            )}
          </div>

          {description && (
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* 角色热血台词 */}
      {dialogue && (
        <div className="rounded bg-muted/40 border-l-2 border-border p-2 text-neutral-800 dark:text-neutral-200">
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground mb-0.5">
            <User className="w-3 h-3" />
            <span>{speaker || (isP0 ? '我方' : '对方')}</span>
          </div>
          <p className="italic font-serif leading-relaxed">「{dialogue}」</p>
        </div>
      )}

      {/* 内心独白 */}
      {innerThoughts && (
        <div className="flex items-start gap-1.5 text-neutral-500 dark:text-neutral-400 italic text-[11px] px-1">
          <Eye className="w-3 h-3 mt-0.5 shrink-0" />
          <p>（{innerThoughts}）</p>
        </div>
      )}

      {/* 生命值变动 */}
      {lpChange && (
        <div className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-semibold">
          <Activity className="w-3.5 h-3.5" />
          <span>
            {lpChange.player === 0 ? '我方' : '对方'} LP {lpChange.oldLp} ➔ {lpChange.newLp} (
            {lpChange.newLp - lpChange.oldLp >= 0 ? '+' : ''}
            {lpChange.newLp - lpChange.oldLp})
          </span>
        </div>
      )}
    </div>
  )
}
