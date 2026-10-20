import React, { useMemo } from 'react'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { AgentProviderPreset, AgentProviderCategory } from '@shared/index'
import { Button } from '../../ui/button'
import { ProviderLogo } from './ProviderLogo'

interface ProviderTemplatePickerProps {
  presets: AgentProviderPreset[]
  onBack: () => void
  onPick: (preset: AgentProviderPreset) => void
  onCreateCustom: () => void
}

const GROUP_ORDER: AgentProviderCategory[] = ['cn', 'global', 'local']

const GROUP_TITLE: Record<AgentProviderCategory, string> = {
  cn: '国内厂商',
  global: '国际厂商',
  local: '本地部署'
}

export const ProviderTemplatePicker: React.FC<ProviderTemplatePickerProps> = ({
  presets,
  onBack,
  onPick,
  onCreateCustom
}) => {
  const groups = useMemo(() => {
    const buckets = new Map<string, AgentProviderPreset[]>()
    for (const preset of presets) {
      const key = preset.category ?? 'other'
      const list = buckets.get(key)
      if (list) list.push(preset)
      else buckets.set(key, [preset])
    }
    const ordered: { id: string; title: string; items: AgentProviderPreset[] }[] = []
    for (const id of GROUP_ORDER) {
      const items = buckets.get(id)
      if (items && items.length > 0) ordered.push({ id, title: GROUP_TITLE[id], items })
    }
    const rest = presets.filter((p) => !p.category)
    ordered.push({ id: 'other', title: '其他', items: rest })
    return ordered
  }, [presets])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xs font-semibold">添加供应商</h2>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <h3 className="text-[10px] font-semibold text-muted-foreground/80">{group.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              {group.id === 'other' && (
                <TemplateCard
                  label="创建自定义供应商"
                  icon={
                    <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </span>
                  }
                  onClick={onCreateCustom}
                />
              )}
              {group.items.map((preset) => (
                <TemplateCard
                  key={preset.id}
                  label={preset.name}
                  icon={
                    <span className="flex w-9 h-9 shrink-0 items-center justify-center">
                      <ProviderLogo presetId={preset.id} className="w-7 h-7" />
                    </span>
                  }
                  onClick={() => onPick(preset)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface TemplateCardProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
}

function TemplateCard({ label, icon, onClick }: TemplateCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 min-w-0 items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-background text-left transition-colors outline-none hover:border-ring/40 hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{label}</span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
    </button>
  )
}
