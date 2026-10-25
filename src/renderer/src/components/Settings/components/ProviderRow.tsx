import type { JSX } from 'react'
import { AgentProviderConfig, AgentProviderPreset } from '@shared/index'
import {
  providerLabel,
  resolveProviderStatus,
  type ProviderStatus
} from '../../../utils/agentModelFormat'
import { cn } from '../../../lib/utils'
import { ProviderEditor } from './ProviderEditor'
import { MODEL_CARD, MODEL_EDITOR } from './modelSettingsStyles'

const STATUS_CLASS: Record<ProviderStatus, string> = {
  ready: 'bg-[#22c55e]',
  unavailable: 'bg-[#ec1313] dark:bg-[#f25a5a]'
}

const STATUS_TITLE: Record<ProviderStatus, string> = {
  ready: 'API 密钥已配置',
  unavailable: 'API 密钥缺失'
}

interface ProviderRowProps {
  provider: AgentProviderConfig
  preset?: AgentProviderPreset
  editing: boolean
  onEdit: () => void
  onRemove: () => void
  onSave: (provider: AgentProviderConfig) => void
  onCancel: () => void
}

export function ProviderRow({
  provider,
  preset,
  editing,
  onEdit,
  onRemove,
  onSave,
  onCancel
}: ProviderRowProps): JSX.Element {
  const status = resolveProviderStatus(provider)

  return (
    <li className={MODEL_CARD}>
      <div className="flex min-w-0 items-center gap-2.5 px-3.5 py-3">
        <span className="min-w-0 truncate text-sm font-medium leading-[22px]">{provider.name}</span>
        {!provider.presetId && (
          <span className="shrink-0 rounded-[4px] border-[0.5px] border-foreground/15 px-1.5 py-px text-[11px] leading-4 text-[#61666b] dark:text-[#cfd3d6]">
            自定义
          </span>
        )}
        <span
          role="img"
          aria-label={STATUS_TITLE[status]}
          className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_CLASS[status])}
        />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`编辑 ${providerLabel(provider)}`}
            onClick={onEdit}
            className="inline-flex h-7 items-center rounded-[8px] border-[0.5px] border-foreground/20 bg-transparent px-2.5 text-xs leading-[18px] text-foreground transition-colors hover:bg-foreground/5 dark:bg-transparent"
          >
            编辑
          </button>
          <button
            type="button"
            aria-label={`删除 ${providerLabel(provider)}`}
            onClick={onRemove}
            className="inline-flex h-7 items-center rounded-[8px] px-2.5 text-xs leading-[18px] text-[#ec1313] transition-colors hover:bg-[rgba(236,19,19,0.05)] dark:text-[#f25a5a] dark:hover:bg-[rgba(242,90,90,0.15)]"
          >
            删除
          </button>
        </div>
      </div>
      {editing && (
        <div className="px-3.5 pb-3">
          <div className={MODEL_EDITOR}>
            <ProviderEditor
              key={provider.id}
              provider={provider}
              preset={preset}
              mode="edit"
              onSave={onSave}
              onCancel={onCancel}
            />
          </div>
        </div>
      )}
    </li>
  )
}
