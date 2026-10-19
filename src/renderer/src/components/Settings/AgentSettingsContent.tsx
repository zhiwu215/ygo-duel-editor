import { ScrollArea } from '../ui/scroll-area'
import React, { useState, useEffect, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import {
  AgentProviderConfig,
  AgentProviderModelConfig,
  AgentProviderPreset,
  DEFAULT_AGENT_API_FORMAT,
  createProviderFromPreset
} from '@shared/index'
import { useAgentStore } from '../../stores/useAgentStore'
import { Button } from '../ui/button'
import { NavItem } from './components/ProviderNavItem'
import { resolveProviderStatus } from '../../utils/agentModelFormat'
import { ProviderDetailPanel } from './components/ProviderDetailPanel'
import { ProviderTemplatePicker } from './components/ProviderTemplatePicker'
import { ChatSettingsSection } from './components/ChatSettingsSection'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export type AgentSettingsSection = 'model-settings' | 'chat'

interface AgentSettingsContentProps {
  section: AgentSettingsSection
}

interface ResolvedSelection {
  provider: AgentProviderConfig
  preset: AgentProviderPreset | null
}

export const AgentSettingsContent: React.FC<AgentSettingsContentProps> = ({ section }) => {
  const {
    config,
    presets,
    loadPresets,
    upsertProvider,
    removeProvider,
    reorderProviders,
    selectModel
  } = useAgentStore()

  const [selection, setSelection] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (presets.length === 0) void loadPresets()
  }, [presets.length, loadPresets])

  const providers = useMemo(() => config.providers ?? [], [config.providers])

  const presetProviders = useMemo(() => providers.filter((p) => Boolean(p.presetId)), [providers])
  const customProviders = useMemo(() => providers.filter((p) => !p.presetId), [providers])

  const effectiveSelection = useMemo((): string | null => {
    if (selection && providers.some((p) => p.id === selection)) return selection
    if (config.provider && providers.some((p) => p.id === config.provider)) return config.provider
    return providers[0]?.id ?? null
  }, [selection, providers, config.provider])

  const resolved = useMemo((): ResolvedSelection | null => {
    if (!effectiveSelection) return null
    const provider = providers.find((p) => p.id === effectiveSelection)
    if (!provider) return null
    const preset = provider.presetId
      ? (presets.find((p) => p.id === provider.presetId) ?? null)
      : null
    return { provider, preset }
  }, [effectiveSelection, providers, presets])

  const activeModelInfo = useMemo((): AgentProviderModelConfig | null => {
    const provider = providers.find((p) => p.id === config.provider)
    return provider?.models.find((m) => m.id === config.model) ?? null
  }, [providers, config.provider, config.model])

  const createCustomProvider = (): void => {
    const id = `custom-${Date.now().toString(36)}`
    upsertProvider({
      id,
      name: '新供应商',
      baseUrl: '',
      apiFormat: DEFAULT_AGENT_API_FORMAT,
      apiKey: '',
      enabled: true,
      models: []
    })
    setSelection(id)
    setPickerOpen(false)
  }

  const pickPreset = (preset: AgentProviderPreset): void => {
    const existing = providers.find((p) => p.presetId === preset.id || p.id === preset.id)
    if (existing) {
      setSelection(existing.id)
      setPickerOpen(false)
      return
    }
    const provider = createProviderFromPreset(preset)
    upsertProvider(provider)
    setSelection(provider.id)
    setPickerOpen(false)
  }

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const requestDelete = (providerId: string, name: string): void => {
    setPendingDelete({ id: providerId, name })
  }

  const confirmDelete = (): void => {
    if (!pendingDelete) return
    const remaining = providers.filter((p) => p.id !== pendingDelete.id)
    removeProvider(pendingDelete.id)
    setSelection(remaining[0]?.id ?? null)
    setPendingDelete(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    })
  )

  const handleCustomReorder = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    reorderProviders(String(active.id), String(over.id))
  }

  return (
    <div className="text-xs">
      {section === 'model-settings' && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] leading-5 text-muted-foreground pt-1">
              管理模型供应商，配置 API Key 后可在背后灵对话中使用。
            </p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加供应商</span>
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card flex h-[520px]">
            <div className="w-44 shrink-0 border-r border-border flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-3">
                  <div>
                    <div className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/80">
                      常用提供商
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {presetProviders.length === 0 && (
                        <p className="px-2 py-1 text-[10px] leading-4 text-muted-foreground/70">
                          点右上角「添加供应商」从内置品牌中选择
                        </p>
                      )}
                      {presetProviders.map((provider) => (
                        <NavItem
                          key={provider.id}
                          active={!pickerOpen && effectiveSelection === provider.id}
                          label={provider.name}
                          status={resolveProviderStatus(provider)}
                          presetId={provider.presetId}
                          onClick={() => {
                            setSelection(provider.id)
                            setPickerOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/80">
                      自定义供应商
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleCustomReorder}
                    >
                      <SortableContext
                        items={customProviders.map((p) => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="flex flex-col gap-0.5">
                          {customProviders.length === 0 && (
                            <p className="px-2 py-1 text-[10px] leading-4 text-muted-foreground/70">
                              还没有自定义供应商
                            </p>
                          )}
                          {customProviders.map((provider) => (
                            <NavItem
                              key={provider.id}
                              active={!pickerOpen && effectiveSelection === provider.id}
                              label={provider.name}
                              status={resolveProviderStatus(provider)}
                              presetId={provider.presetId}
                              sortable
                              sortId={provider.id}
                              onClick={() => {
                                setSelection(provider.id)
                                setPickerOpen(false)
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <ScrollArea className="flex-1 min-w-0">
              <div className="p-4">
                {pickerOpen ? (
                  <ProviderTemplatePicker
                    presets={presets}
                    onBack={() => setPickerOpen(false)}
                    onPick={pickPreset}
                    onCreateCustom={createCustomProvider}
                  />
                ) : resolved ? (
                  <ProviderDetailPanel
                    key={resolved.provider.id}
                    provider={resolved.provider}
                    preset={resolved.preset}
                    activeProviderId={config.provider}
                    activeModelId={config.model}
                    onUpsert={upsertProvider}
                    onRemove={() => requestDelete(resolved.provider.id, resolved.provider.name)}
                    onSelectModel={selectModel}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-[11px] text-muted-foreground">
                    <span>还没有添加任何供应商</span>
                    <Button size="xs" variant="outline" onClick={() => setPickerOpen(true)}>
                      添加供应商
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {section === 'chat' && (
        <ChatSettingsSection config={config} activeModelInfo={activeModelInfo} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`确认删除供应商「${pendingDelete?.name ?? ''}」？`}
        description="该供应商下的 API Key 与模型列表将一并移除，此操作不可撤销。"
        confirmText="删除"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
