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
  presetId?: string
  className?: string
}

interface LogoAsset {
  light: string
  dark?: string
  monochrome?: boolean
}

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
  ollama: { light: ollamaLogo, monochrome: true }
}

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
