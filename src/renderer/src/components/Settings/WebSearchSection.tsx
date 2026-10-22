import { useState, type JSX } from 'react'
import { Eye, EyeOff, Globe } from 'lucide-react'
import {
  MAX_WEB_SEARCH_COUNT,
  normalizeWebSearchConfig,
  resolveWebSearchApiKey,
  findDeepSeekProviderKey
} from '@shared/index'
import { useAgentStore } from '../../stores/useAgentStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import {
  MODEL_ERROR,
  MODEL_HINT,
  MODEL_INPUT,
  MODEL_NOTICE
} from './components/modelSettingsStyles'

export function WebSearchSection(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const setWebSearchConfig = useConfigStore((state) => state.setWebSearchConfig)
  const agentConfig = useAgentStore((state) => state.config)
  const [draft, setDraft] = useState(() => normalizeWebSearchConfig(config.webSearch))
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const deepSeekKey = findDeepSeekProviderKey(agentConfig)
  const effectiveKey = resolveWebSearchApiKey(draft, agentConfig)
  const keyReady = effectiveKey.length > 0
  const keyLocked = draft.reuseProviderKey && deepSeekKey.length > 0
  const reuseHint = !draft.reuseProviderKey
    ? '使用下方单独填写的 Key 进行网页搜索。'
    : deepSeekKey
      ? '已从「设置 → 模型」的 DeepSeek 供应商检测到密钥，将直接复用。'
      : draft.apiKey.length > 0
        ? '未检测到 DeepSeek 供应商密钥，当前使用下方单独填写的 Key。'
        : '未检测到 DeepSeek 供应商密钥；请关闭复用并在下方填写，或先在模型页配置 DeepSeek。'
  const reuseWarning = draft.reuseProviderKey && !deepSeekKey && draft.apiKey.length === 0

  const patch = (value: Partial<typeof draft>): void => {
    setSaved(false)
    setDraft((current) => ({ ...current, ...value }))
  }

  const save = (): void => {
    const next = normalizeWebSearchConfig(draft)
    setDraft(next)
    void setWebSearchConfig(next).then(() => setSaved(true))
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="rounded-[20px] border-[0.5px] border-foreground/20 bg-white px-3.5 dark:bg-[#2c2c2e]">
        <div className="flex items-center justify-between gap-6 border-b border-border/60 py-3.5">
          <div className="min-w-0">
            <div className="text-sm font-medium">启用网页搜索</div>
            <p className={cn(MODEL_HINT, 'mt-1 leading-relaxed')}>
              开启后，背后灵可以搜索互联网并读取网页正文；网页内容会被标记为不可信资料。
            </p>
          </div>
          <Switch
            checked={draft.enabled}
            aria-label="启用网页搜索"
            onCheckedChange={(enabled) => patch({ enabled })}
          />
        </div>

        <div className="flex items-center justify-between gap-6 border-b border-border/60 py-3.5">
          <div className="min-w-0">
            <div className="text-sm font-medium">搜索提供方</div>
            <p className={cn(MODEL_HINT, 'mt-1 leading-relaxed')}>
              使用 DeepSeek 的 Web Search / Fetch API，搜索与网页抓取共用同一个 Key。
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs text-foreground">
            <Globe className="h-3.5 w-3.5" />
            DeepSeek 网页搜索 API
          </span>
        </div>

        <div className="flex items-center justify-between gap-6 border-b border-border/60 py-3.5">
          <div className="min-w-0">
            <div className="text-sm font-medium">复用 DeepSeek 供应商密钥</div>
            <p className={cn(reuseWarning ? MODEL_NOTICE : MODEL_HINT, 'mt-1 leading-relaxed')}>
              {reuseHint}
            </p>
          </div>
          <Switch
            checked={draft.reuseProviderKey}
            aria-label="复用 DeepSeek 供应商密钥"
            onCheckedChange={(reuseProviderKey) => patch({ reuseProviderKey })}
          />
        </div>

        <div className="border-b border-border/60 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">DeepSeek API Key</span>
            <span className={cn('text-[11px]', keyReady ? 'text-[#15803d]' : MODEL_ERROR)}>
              {keyReady ? '已配置' : '未配置'}
            </span>
          </div>
          <div className="relative mt-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(event) => patch({ apiKey: event.target.value })}
              placeholder={keyLocked ? '使用 DeepSeek 供应商密钥' : '输入 DeepSeek API Key'}
              aria-label="DeepSeek API Key"
              spellCheck={false}
              autoComplete="new-password"
              disabled={keyLocked}
              className={cn(MODEL_INPUT, 'pr-10 disabled:opacity-60')}
            />
            {draft.apiKey.length > 0 && (
              <button
                type="button"
                aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                onClick={() => setShowKey((value) => !value)}
                className="absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#81858c] transition-colors hover:bg-foreground/5 hover:text-foreground dark:text-[#979da6]"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p className={cn(MODEL_HINT, 'mt-1.5 leading-relaxed')}>
            {keyLocked
              ? '当前复用 DeepSeek 供应商密钥；如需单独填写，请先关闭「复用 DeepSeek 供应商密钥」。'
              : '网页搜索独立于聊天模型：聊天模型不是 DeepSeek，也可以单独使用这里的 Key。'}
          </p>
        </div>

        <div className="border-b border-border/60 py-3.5">
          <div className="text-sm font-medium">API 地址</div>
          <input
            type="text"
            value={draft.baseUrl}
            onChange={(event) => patch({ baseUrl: event.target.value })}
            placeholder="https://api.deepseek.com/v1/tools"
            aria-label="网页搜索 API 地址"
            spellCheck={false}
            className={cn(MODEL_INPUT, 'mt-2')}
          />
          <p className={cn(MODEL_HINT, 'mt-1.5 leading-relaxed')}>
            填写包含路径前缀的地址，程序会追加 /search 或 /fetch。
          </p>
        </div>

        <div className="py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">每次搜索结果数</span>
            <input
              type="number"
              min={1}
              max={MAX_WEB_SEARCH_COUNT}
              value={draft.count}
              aria-label="每次搜索结果数"
              onChange={(event) =>
                patch({ count: event.target.value === '' ? 1 : Number(event.target.value) })
              }
              className="h-8 w-24 rounded-[12px] border-[0.5px] border-foreground/20 bg-white px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 dark:bg-[#232324]"
            />
          </div>
          <p className={cn(MODEL_HINT, 'mt-1.5 leading-relaxed')}>
            每个关键词返回的结果条数，1–{MAX_WEB_SEARCH_COUNT}，默认 10；一次最多合并 8 个来源。
          </p>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span role="status" className="mr-auto text-xs text-[#15803d] dark:text-[#4ade80]">
            已保存网页搜索设置。
          </span>
        )}
        <Button
          size="default"
          onClick={save}
          className="h-9 rounded-[12px] bg-foreground px-3.5 text-sm text-background hover:bg-foreground/90"
        >
          保存
        </Button>
      </div>
    </div>
  )
}
