import React, { useEffect, useState } from 'react'
import { Boxes } from 'lucide-react'
import alibabaCloudLogo from '../../../assets/provider-icons/model-provider-alibaba-cloud.png'
import anthropicLogo from '../../../assets/provider-icons/model-provider-anthropic.png'
import deepseekLogo from '../../../assets/provider-icons/model-provider-deepseek.png'
import minimaxLogo from '../../../assets/provider-icons/model-provider-minimax.png'
import moonshotKimiLogo from '../../../assets/provider-icons/model-provider-moonshot-kimi.png'
import ollamaLogo from '../../../assets/provider-icons/model-provider-ollama.png'
import openAiLogo from '../../../assets/provider-icons/model-provider-openai.png'
import startPlanLogo from '../../../assets/provider-icons/model-provider-start-plan.png'
import xaiLogo from '../../../assets/provider-icons/model-provider-xai.png'
import xiaomiMimoLogo from '../../../assets/provider-icons/model-provider-xiaomi-mimo.png'
import zaiAppLogo from '../../../assets/provider-icons/model-provider-zai-app.png'
import zaiLogo from '../../../assets/provider-icons/model-provider-zai.png'
import bigModelLogo from '../../../assets/provider-icons/logo-bigmodel.svg'
import openrouterLight from '../../../assets/provider-icons/model-provider-openrouter-light.svg'
import openrouterDark from '../../../assets/provider-icons/model-provider-openrouter-dark.svg'
import opencodeLight from '../../../assets/provider-icons/model-provider-opencode-light.svg'
import opencodeDark from '../../../assets/provider-icons/model-provider-opencode-dark.svg'
import { cn } from '../../../lib/utils'

interface ProviderLogoProps {
  /** 供应商的 presetId（如 deepseek / dashscope / moonshot），自定义供应商传undefined */
  presetId?: string
  className?: string
}

interface LogoAsset {
  light: string
  dark?: string
  /** 单色线稿：深色主题下用 CSS 反色渲染（图片文件本身不做修改） */
  monochrome?: boolean
}

/**
 * 内置供应商品牌图映射，键为供应商标识。
 * 素材来源与品牌归属见同目录 model-provider-logo-sources.json（均为各厂商官方商标）。
 */
const LOGO_ASSETS: Record<string, LogoAsset> = {
  deepseek: { light: deepseekLogo },
  dashscope: { light: alibabaCloudLogo },
  qwen: { light: alibabaCloudLogo },
  moonshot: { light: moonshotKimiLogo },
  kimi: { light: moonshotKimiLogo },
  anthropic: { light: anthropicLogo },
  openai: { light: openAiLogo },
  xai: { light: xaiLogo },
  minimax: { light: minimaxLogo },
  'xiaomi-mimo': { light: xiaomiMimoLogo },
  zai: { light: zaiAppLogo, dark: zaiLogo },
  bigmodel: { light: bigModelLogo },
  'start-plan': { light: startPlanLogo },
  openrouter: { light: openrouterLight, dark: openrouterDark },
  opencode: { light: opencodeLight, dark: opencodeDark },
  // 官方只提供黑色线稿（无白色版本），深色主题靠 CSS 反色，避免多存一份改过的图
  ollama: { light: ollamaLogo, monochrome: true }
}

/**
 * 供应商图标：优先展示内置预设的品牌图，加载失败或未内置时回退到通用图标。
 * 兜底图标与传入的 className 同尺寸，避免在窄行 / 大卡片两种场景下大小失配。
 */
export const ProviderLogo: React.FC<ProviderLogoProps> = ({ presetId, className }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const asset = presetId ? LOGO_ASSETS[presetId] : undefined
  const src = asset ? (isDark ? (asset.dark ?? asset.light) : asset.light) : undefined

  if (!src || failedSrc === src) {
    return <Boxes className={cn('text-muted-foreground/70', className ?? 'w-3.5 h-3.5')} />
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={cn('object-contain', asset?.monochrome && isDark && 'invert', className)}
      onError={() => setFailedSrc(src)}
    />
  )
}
